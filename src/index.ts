import os from "node:os";
import path from "node:path";
import { CronJob } from "cron";
import { env } from "./env";
import { dumpToFile } from "./helpers/dumpToFile";
import { uploadToS3 } from "./helpers/uploadToS3";
import { deleteFile } from "./utils/deleteFile";
import { logger } from "./utils/logger";

const tryBackup = async () => {
  try {
    logger.info("Starting backup...");
    logger.break();

    const date = new Date().toISOString();
    const timestamp = date.replaceAll(/[:.]/g, "-");
    const fileName = `${env.BACKUP_FILE_PREFIX}-${timestamp}.sql.gz`;
    const filePath = path.join(os.tmpdir(), fileName);

    await dumpToFile(filePath);
    await uploadToS3({ name: fileName, filePath });
    await deleteFile(filePath);

    logger.break();
    logger.success("Backup completed successfully.");
  } catch (error) {
    logger.error("Backup failed:");
    console.error(error);
    process.exit(1);
  }
};

if (env.RUN_ON_STARTUP || env.SINGLE_SHOT_MODE) {
  await tryBackup();

  if (env.SINGLE_SHOT_MODE) {
    process.exit(0);
  }
}

const job = new CronJob(env.BACKUP_CRON_SCHEDULE, async () => {
  await tryBackup();
});

job.start();

logger.info(
  `Backup job scheduled with cron pattern: ${env.BACKUP_CRON_SCHEDULE}`,
);
logger.break();
