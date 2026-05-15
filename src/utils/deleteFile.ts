import { logger } from "./logger";

export async function deleteFile(filePath: string) {
  try {
    await Bun.file(filePath).delete();
  } catch (error) {
    logger.error(`Error deleting temporary file: ${filePath}`);
    throw error;
  }
}
