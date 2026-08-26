import { env } from "../env";
import { s3Client } from "../lib/s3";
import { logger } from "../utils/logger";

interface UploadToS3Props {
  name: string;
  filePath: string;
}

export async function uploadToS3({ name, filePath }: UploadToS3Props) {
  logger.info("Uploading backup to S3...");

  if (env.BUCKET_SUBFOLDER) {
    name = `${env.BUCKET_SUBFOLDER}/${name}`;
  }

  await s3Client.write(name, Bun.file(filePath));

  logger.success("Upload completed.");
}
