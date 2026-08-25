import { logger } from "./logger";

export async function cleanupTemporaryFile(filePath: string) {
  try {
    const file = Bun.file(filePath);

    if (await file.exists()) {
      await file.delete();
    }
  } catch (error) {
    logger.error(`Failed to clean up temporary file: ${filePath}`);
    console.error(error);
  }
}
