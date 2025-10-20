import { filesize } from "filesize";
import { env } from "../env";
import { logger } from "../utils/logger";

export const dumpToFile = async (filePath: string) => {
  logger.info("Dumping database to file...");

  const pgDumpArgs = [`--dbname=${env.DATABASE_URL}`, "--format=tar"];

  if (env.BACKUP_OPTIONS) {
    const extraOptions = env.BACKUP_OPTIONS.split(" ");
    pgDumpArgs.push(...extraOptions);
  }

  const pgDumpProcess = Bun.spawn({
    cmd: ["pg_dump", ...pgDumpArgs],
    stderr: "inherit",
  });

  const pgDumpProcessCode = await pgDumpProcess.exited;
  if (pgDumpProcessCode !== 0) {
    logger.error(
      `pg_dump process exited with code ${pgDumpProcessCode}; check for errors above.`,
    );
    throw new Error("Failed to dump the database.");
  }

  const gzipProcess = Bun.spawn({
    cmd: ["gzip"],
    stdin: pgDumpProcess.stdout,
    stdout: Bun.file(filePath),
    stderr: "inherit",
  });

  const gzipProcessCode = await gzipProcess.exited;
  if (gzipProcessCode !== 0) {
    logger.error(
      `gzip process exited with code ${gzipProcessCode}; check for errors above.`,
    );
    throw new Error("Failed to compress the database dump.");
  }

  // Check if archive is valid and contains data
  const isValidArchive = Bun.spawnSync({
    cmd: ["tar", "-tzf", filePath],
  });

  if (isValidArchive.exitCode !== 0) {
    logger.error("The database dump archive is invalid or empty.");
    throw new Error("Invalid database dump archive");
  }

  logger.info("Database dump archive is valid and contains data.");
  logger.info(`Database filesize: ${filesize(Bun.file(filePath).size)}`);

  logger.success("Database dumped successfully.");
  logger.break();
};
