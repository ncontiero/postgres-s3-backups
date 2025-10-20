import { env } from "../env";
import { logger } from "../utils/logger";

interface UploadToS3Props {
  name: string;
  filePath: string;
}

export const uploadToS3 = async ({ name, filePath }: UploadToS3Props) => {
  logger.info("Uploading backup to S3...");

  const s3Client = new Bun.S3Client({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    bucket: env.AWS_S3_BUCKET,
    region: env.AWS_S3_REGION,
    endpoint: env.AWS_S3_ENDPOINT,
  });

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
      writer.write(chunk);
    }
    await writer.end();
  } else {
    await s3Client.write(name, localFile);
  }

  logger.success("Upload completed.");
};
