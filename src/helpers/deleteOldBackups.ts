import { env } from "../env";
import { s3Client } from "../lib/s3";
import { logger } from "../utils/logger";

export async function deleteOldBackups() {
  if (env.BACKUP_KEEP_DAYS === undefined) {
    return;
  }

  logger.info(
    `Checking for backups older than ${env.BACKUP_KEEP_DAYS} days...`,
  );

  const prefix = env.BUCKET_SUBFOLDER
    ? `${env.BUCKET_SUBFOLDER}/${env.BACKUP_FILE_PREFIX}`
    : env.BACKUP_FILE_PREFIX;

  try {
    let isTruncated = true;
    let continuationToken: string | undefined;

    const now = new Date();
    // Convert days to milliseconds (days * 24 hours * 60 minutes * 60 seconds * 1000 ms)
    const keepDaysInMs = env.BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - keepDaysInMs);

    let deletedCount = 0;

    while (isTruncated) {
      const response = await s3Client.list({
        prefix,
        continuationToken,
      });

      if (response.contents) {
        for (const file of response.contents) {
          if (!file.lastModified) {
            logger.warn(
              `Backup ${file.key} is missing lastModified property, skipping.`,
            );
            continue;
          }

          if (new Date(file.lastModified) < cutoffDate) {
            logger.info(`Deleting old backup: ${file.key}`);
            await s3Client.delete(file.key);
            deletedCount++;
          }
        }
      }

      isTruncated = response.isTruncated ?? false;
      if (isTruncated) {
        continuationToken = response.nextContinuationToken;
      }
    }

    if (deletedCount > 0) {
      logger.success(`Successfully deleted ${deletedCount} old backup(s).`);
    } else {
      logger.info("No old backups found to delete.");
    }
  } catch (error) {
    logger.error("Failed to delete old backups:");
    console.error(error);
  }
}
