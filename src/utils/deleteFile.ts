import { logger } from "./logger";

export const deleteFile = async (filePath: string) => {
  try {
    await Bun.file(filePath).delete();
  } catch (error) {
    logger.error(`Error deleting temporary file: ${filePath}`);
    throw error;
  }
};
