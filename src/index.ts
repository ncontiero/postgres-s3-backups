import os from "node:os";
import path from "node:path";
import { env } from "./env";
import { deleteOldBackups } from "./helpers/deleteOldBackups";
import { dumpToFile } from "./helpers/dumpToFile";
import { uploadToS3 } from "./helpers/uploadToS3";
import { cleanupTemporaryFile } from "./utils/cleanupTemporaryFile";
import { logger } from "./utils/logger";

async function runBackup() {
  logger.info("Starting backup...");
  logger.break();

  const date = new Date().toISOString();
  const timestamp = date.replaceAll(/[:.]/g, "-");
  const fileName = `${env.BACKUP_FILE_PREFIX}-${timestamp}.tar.gz`;
  const filePath = path.join(os.tmpdir(), fileName);

  try {
    await dumpToFile(filePath);
    await uploadToS3({ name: fileName, filePath });
  } finally {
    await cleanupTemporaryFile(filePath);
  }

  try {
    await deleteOldBackups();
  } catch (error) {
    logger.error("Failed to delete old backups:");
    console.error(error);

    logger.break();
    logger.warn("Backup uploaded successfully, but retention cleanup failed.");
    return;
  }

  logger.break();
  logger.success("Backup completed successfully.");
}

function validateRequiredCommands() {
  for (const command of ["pg_dump", "tar"]) {
    if (!Bun.which(command)) {
      throw new Error(`${command} is not available.`);
    }
  }
}

function logBackupFailure(error: unknown) {
  logger.error("Backup failed:");
  console.error(error);
}

async function runScheduledBackup() {
  try {
    await runBackup();
  } catch (error) {
    logBackupFailure(error);
  }
}

async function main() {
  validateRequiredCommands();

  if (env.SINGLE_SHOT_MODE) {
    await runBackup();
    return;
  }

  if (env.RUN_ON_STARTUP) {
    await runScheduledBackup();
  }

  Bun.cron(env.BACKUP_CRON_SCHEDULE, runScheduledBackup);

  logger.info(
    `Backup job scheduled with cron pattern: ${env.BACKUP_CRON_SCHEDULE}`,
  );
  logger.break();
}

try {
  await main();
} catch (error) {
  logBackupFailure(error);
  process.exitCode = 1;
}
