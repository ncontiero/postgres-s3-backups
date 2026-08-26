import os from "node:os";
import path from "node:path";
import { env } from "./env";
import { deleteOldBackups } from "./helpers/deleteOldBackups";
import { dumpToFile } from "./helpers/dumpToFile";
import { uploadToS3 } from "./helpers/uploadToS3";
import { cleanupTemporaryFile } from "./utils/cleanupTemporaryFile";
import { logger } from "./utils/logger";

async function tryBackup() {
  try {
    logger.info("Starting backup...");
    logger.break();

    for (const command of ["pg_dump", "tar"]) {
      if (!Bun.which(command)) {
        throw new Error(`${command} is not available.`);
      }
    }

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

    await deleteOldBackups();

    logger.break();
    logger.success("Backup completed successfully.");
  } catch (error) {
    logger.error("Backup failed:");
    console.error(error);
    process.exit(1);
  }
}

if (env.RUN_ON_STARTUP || env.SINGLE_SHOT_MODE) {
  await tryBackup();

  if (env.SINGLE_SHOT_MODE) {
    process.exit(0);
  }
}

Bun.cron(env.BACKUP_CRON_SCHEDULE, tryBackup);

logger.info(
  `Backup job scheduled with cron pattern: ${env.BACKUP_CRON_SCHEDULE}`,
);
logger.break();
