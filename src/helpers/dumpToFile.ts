import { env } from "../env";
import { formatFileSize } from "../utils/formatFileSize";
import { logger } from "../utils/logger";
import { prepareDatabaseConnection } from "../utils/prepareDatabaseConnection";

export async function dumpToFile(filePath: string) {
  logger.info("Dumping database to file...");

  const { connectionString, password } = prepareDatabaseConnection(
    env.DATABASE_URL,
  );
  const pgDumpArgs = [`--dbname=${connectionString}`];

  if (env.BACKUP_OPTIONS) {
    const extraOptions = env.BACKUP_OPTIONS.split(" ");
    pgDumpArgs.push(...extraOptions);
  }

  pgDumpArgs.push("--format=tar");

  const pgDumpEnvironment = { ...Bun.env };
  delete pgDumpEnvironment.DATABASE_URL;
  delete pgDumpEnvironment.PGDATABASE;

  if (password !== undefined) {
    pgDumpEnvironment.PGPASSWORD = password;
  }

  const pgDumpProcess = Bun.spawn({
    cmd: ["pg_dump", ...pgDumpArgs],
    env: pgDumpEnvironment,
    stderr: "inherit",
  });

  const compressedStream = pgDumpProcess.stdout.pipeThrough(
    new CompressionStream("gzip"),
  );
  const writeCompressedDump = async () => {
    const writer = Bun.file(filePath).writer();

    try {
      for await (const chunk of compressedStream) {
        void writer.write(chunk);
      }
    } finally {
      await writer.end();
    }
  };

  let pgDumpProcessCode: number;
  try {
    [pgDumpProcessCode] = await Promise.all([
      pgDumpProcess.exited,
      writeCompressedDump(),
    ]);
  } catch (error) {
    if (pgDumpProcess.exitCode === null) {
      pgDumpProcess.kill();
      await pgDumpProcess.exited;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write the compressed database dump: ${message}`);
  }

  if (pgDumpProcessCode !== 0) {
    logger.error(
      `pg_dump process exited with code ${pgDumpProcessCode}; check for errors above.`,
    );
    throw new Error("Failed to dump the database.");
  }

  const backupFile = Bun.file(filePath);
  if (backupFile.size === 0) {
    throw new Error("The database dump archive is empty.");
  }

  const tarProcess = Bun.spawn({
    cmd: ["tar", "-tzf", filePath, "toc.dat", "restore.sql"],
    stdout: "ignore",
    stderr: "inherit",
  });

  const tarProcessCode = await tarProcess.exited;
  if (tarProcessCode !== 0) {
    logger.error(
      `tar process exited with code ${tarProcessCode}; check for errors above.`,
    );
    throw new Error("Invalid database dump archive.");
  }

  logger.info("Database dump archive is valid.");
  logger.info(`Database filesize: ${formatFileSize(backupFile.size)}`);

  logger.success("Database dumped successfully.");
  logger.break();
}
