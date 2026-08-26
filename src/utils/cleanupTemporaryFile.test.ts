import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { cleanupTemporaryFile } from "./cleanupTemporaryFile";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, {
        recursive: true,
        force: true,
      });
    }),
  );
});

async function createTemporaryPath() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "postgres-s3-backups-test-"),
  );
  temporaryDirectories.push(directory);
  return path.join(directory, "backup.tar.gz");
}

describe("cleanupTemporaryFile", () => {
  test("deletes an existing temporary file", async () => {
    const filePath = await createTemporaryPath();
    await Bun.write(filePath, "backup");

    await cleanupTemporaryFile(filePath);

    expect(await Bun.file(filePath).exists()).toBe(false);
  });

  test("does nothing when the temporary file does not exist", async () => {
    const filePath = await createTemporaryPath();

    await cleanupTemporaryFile(filePath);

    expect(await Bun.file(filePath).exists()).toBe(false);
  });
});
