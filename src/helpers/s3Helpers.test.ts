import { beforeEach, describe, expect, mock, test } from "bun:test";

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
const write = mock<(name: string, file: Blob) => number>(() => 0);

void mock.module("../env", () => ({ env: testEnvironment }));
void mock.module("../lib/s3", () => ({
  s3Client: {
    delete: deleteObject,
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
  write.mockClear();
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
  test("uploads to the bucket root when no subfolder is configured", async () => {
    await uploadToS3({
      name: "backup.tar.gz",
      filePath: "/tmp/backup.tar.gz",
    });

    expect(write.mock.calls[0]?.[0]).toBe("backup.tar.gz");
  });

  test("uploads a BunFile using the configured subfolder", async () => {
    testEnvironment.BUCKET_SUBFOLDER = "postgres";

    await uploadToS3({
      name: "backup.tar.gz",
      filePath: "/tmp/backup.tar.gz",
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toBe("postgres/backup.tar.gz");
    expect(write.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
  });

  test("propagates upload failures", async () => {
    write.mockImplementationOnce(() => {
      throw new Error("S3 unavailable");
    });

    await expectToReject(async () => {
      await uploadToS3({
        name: "backup.tar.gz",
        filePath: "/tmp/backup.tar.gz",
      });
    }, "S3 unavailable");
  });
});
