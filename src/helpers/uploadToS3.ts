import { env } from "../env";
import { logger } from "../utils/logger";

interface UploadToS3Props {
  name: string;
  filePath: string;
}

const s3Client = new Bun.S3Client({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
});

export async function uploadToS3({ name, filePath }: UploadToS3Props) {
  logger.info("Uploading backup to S3...");

  if (env.BUCKET_SUBFOLDER) {
    name = `${env.BUCKET_SUBFOLDER}/${name}`;
  }

  const localFile = Bun.file(filePath);
  const largeDataChunks = localFile.size > 5 * 1024 * 1024; // 5MB
  if (largeDataChunks) {
    logger.info("Large file detected, using multipart upload...");

    const s3File = s3Client.file(name);
    const writer = s3File.writer();

    for await (const chunk of localFile.stream()) {
      void writer.write(chunk);
    }
    await writer.end();
  } else {
    await s3Client.write(name, localFile);
  }

  logger.success("Upload completed.");
}
