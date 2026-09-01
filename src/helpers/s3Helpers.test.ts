import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

interface ListedBackup {
  key: string;
  lastModified?: Date;
}

interface ListResponse {
  contents?: ListedBackup[];
  isTruncated?: boolean;
  nextContinuationToken?: string;
}

const testEnvironment: {
  BACKUP_FILE_PREFIX: string;
  BACKUP_RETENTION_DAYS: number | undefined;
  BUCKET_SUBFOLDER: string | undefined;
} = {
  BACKUP_FILE_PREFIX: "backup",
  BACKUP_RETENTION_DAYS: 1,
  BUCKET_SUBFOLDER: undefined,
};

const listResponses: ListResponse[] = [];
const list = mock((): ListResponse => {
  const response = listResponses.shift();
  if (!response) {
    throw new Error("Missing mocked S3 list response.");
  }
  return response;
});
const deleteObject = mock<(key: string) => void>(() => {});
const write = mock<(name: string, file: Blob) => Promise<void>>(async () => {});
const writeChunk = mock<(chunk: Uint8Array) => number>(() => 0);
const end = mock<() => Promise<void>>(async () => {});
const createWriter = mock(() => ({
  write: writeChunk,
  end,
}));
const file = mock((name: string) => {
  void name;
  return { writer: createWriter };
});

void mock.module("../env", () => ({ env: testEnvironment }));
void mock.module("../lib/s3", () => ({
  s3Client: {
    delete: deleteObject,
    file,
    list,
    write,
  },
}));
void mock.module("../utils/logger", () => ({
  logger: {
    break: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
    warn: mock(() => {}),
  },
}));

const { deleteOldBackups } = await import("./deleteOldBackups");
const { uploadToS3 } = await import("./uploadToS3");

const multipartUploadThreshold = 5 * 1024 * 1024;
const temporaryFiles = new Set<string>();

async function createTemporaryFile(size: number) {
  const filePath = path.join(
    os.tmpdir(),
    `postgres-s3-backups-${randomUUID()}.tar.gz`,
  );

  await Bun.write(filePath, new Uint8Array(size));
  temporaryFiles.add(filePath);

  return filePath;
}

async function expectToReject(
  operation: () => Promise<unknown>,
  expectedMessage: string,
) {
  let thrownError: unknown;

  try {
    await operation();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(Error);
  expect((thrownError as Error).message).toBe(expectedMessage);
}

beforeEach(() => {
  testEnvironment.BACKUP_FILE_PREFIX = "backup";
  testEnvironment.BACKUP_RETENTION_DAYS = 1;
  testEnvironment.BUCKET_SUBFOLDER = undefined;
  listResponses.length = 0;
  list.mockClear();
  deleteObject.mockClear();
  file.mockClear();
  createWriter.mockClear();
  writeChunk.mockClear();
  end.mockClear();
  write.mockClear();
});

afterEach(async () => {
  for (const filePath of temporaryFiles) {
    const temporaryFile = Bun.file(filePath);

    if (await temporaryFile.exists()) {
      await temporaryFile.delete();
    }
  }

  temporaryFiles.clear();
});

describe("deleteOldBackups", () => {
  test("skips S3 when retention is disabled", async () => {
    testEnvironment.BACKUP_RETENTION_DAYS = undefined;

    await deleteOldBackups();

    expect(list).not.toHaveBeenCalled();
  });

  test("paginates and deletes only expired backups", async () => {
    const now = Date.now();
    listResponses.push(
      {
        contents: [
          {
            key: "backup-old.tar.gz",
            lastModified: new Date(now - 2 * 24 * 60 * 60 * 1000),
          },
          {
            key: "backup-current.tar.gz",
            lastModified: new Date(now),
          },
        ],
        isTruncated: true,
        nextContinuationToken: "next-page",
      },
      {
        contents: [],
        isTruncated: false,
      },
    );

    await deleteOldBackups();

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenNthCalledWith(1, {
      prefix: "backup",
      continuationToken: undefined,
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      prefix: "backup",
      continuationToken: "next-page",
    });
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith("backup-old.tar.gz");
  });

  test("skips a backup without lastModified metadata", async () => {
    listResponses.push({
      contents: [{ key: "backup-without-date.tar.gz" }],
      isTruncated: false,
    });

    await deleteOldBackups();

    expect(deleteObject).not.toHaveBeenCalled();
  });

  test("rejects a truncated response without a continuation token", async () => {
    listResponses.push({ isTruncated: true });

    await expectToReject(
      deleteOldBackups,
      "S3 returned a truncated backup list without a valid continuation token.",
    );
  });

  test("rejects a repeated continuation token", async () => {
    listResponses.push(
      {
        isTruncated: true,
        nextContinuationToken: "same-token",
      },
      {
        isTruncated: true,
        nextContinuationToken: "same-token",
      },
    );

    await expectToReject(
      deleteOldBackups,
      "S3 returned a truncated backup list without a valid continuation token.",
    );
  });
});

describe("uploadToS3", () => {
  test("uses a direct upload for files up to 5 MiB", async () => {
    const filePath = await createTemporaryFile(multipartUploadThreshold);

    await uploadToS3({
      name: "backup.tar.gz",
      filePath,
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toBe("backup.tar.gz");
    expect(write.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
    expect(file).not.toHaveBeenCalled();
  });

  test("streams larger files to a subfolder and awaits finalization", async () => {
    testEnvironment.BUCKET_SUBFOLDER = "postgres";
    const filePath = await createTemporaryFile(multipartUploadThreshold + 1);

    let signalEndCalled: () => void = () => {};
    const endCalled = new Promise<void>((resolve) => {
      signalEndCalled = resolve;
    });
    let finishEnd: () => void = () => {};
    const endPending = new Promise<void>((resolve) => {
      finishEnd = resolve;
    });

    end.mockImplementationOnce(async () => {
      signalEndCalled();
      await endPending;
    });

    let uploadFinished = false;
    const upload = (async () => {
      await uploadToS3({
        name: "backup.tar.gz",
        filePath,
      });
      uploadFinished = true;
    })();

    await endCalled;

    expect(uploadFinished).toBe(false);
    expect(file).toHaveBeenCalledTimes(1);
    expect(file).toHaveBeenCalledWith("postgres/backup.tar.gz");
    expect(createWriter).toHaveBeenCalledTimes(1);
    expect(writeChunk).toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    finishEnd();
    await upload;

    expect(end).toHaveBeenCalledTimes(1);
    expect(uploadFinished).toBe(true);
  });

  test("propagates direct upload failures", async () => {
    const filePath = await createTemporaryFile(1);

    write.mockRejectedValueOnce(new Error("S3 unavailable"));

    await expectToReject(async () => {
      await uploadToS3({
        name: "backup.tar.gz",
        filePath,
      });
    }, "S3 unavailable");
  });

  test("propagates multipart finalization failures", async () => {
    const filePath = await createTemporaryFile(multipartUploadThreshold + 1);

    end.mockRejectedValueOnce(new Error("Multipart finalization failed"));

    await expectToReject(async () => {
      await uploadToS3({
        name: "backup.tar.gz",
        filePath,
      });
    }, "Multipart finalization failed");
  });
});
