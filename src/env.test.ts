import path from "node:path";
import { describe, expect, test } from "bun:test";

const projectRoot = path.resolve(import.meta.dir, "..");
const requiredEnvironment = {
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  S3_BUCKET: "test-bucket",
  S3_REGION: "us-east-1",
  DATABASE_URL: "postgresql://user:password@localhost:5432/database",
};

const readEnvironmentScript = `
  const { env } = await import("./src/env.ts");
  console.log(JSON.stringify(env));
`;

async function loadEnvironment(overrides: Record<string, string> = {}) {
  const childProcess = Bun.spawn({
    cmd: [process.execPath, "--no-env-file", "--eval", readEnvironmentScript],
    cwd: projectRoot,
    env: {
      ...requiredEnvironment,
      ...overrides,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    childProcess.exited,
    childProcess.stdout.text(),
    childProcess.stderr.text(),
  ]);

  return { exitCode, stdout, stderr };
}

describe("environment validation", () => {
  test("applies default values", async () => {
    const result = await loadEnvironment();

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      BACKUP_CRON_SCHEDULE: "0 0 * * *",
      BACKUP_FILE_PREFIX: "backup",
      RUN_ON_STARTUP: false,
      SINGLE_SHOT_MODE: false,
    });
  });

  test("parses booleans and retention days", async () => {
    const result = await loadEnvironment({
      BACKUP_RETENTION_DAYS: "7",
      RUN_ON_STARTUP: "TRUE",
      SINGLE_SHOT_MODE: "1",
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      BACKUP_RETENTION_DAYS: 7,
      RUN_ON_STARTUP: true,
      SINGLE_SHOT_MODE: true,
    });
  });

  test("rejects an invalid cron expression", async () => {
    const result = await loadEnvironment({
      BACKUP_CRON_SCHEDULE: "not-a-cron-expression",
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("invalid BACKUP_CRON_SCHEDULE format");
  });

  test("rejects a missing required credential", async () => {
    const result = await loadEnvironment({ AWS_ACCESS_KEY_ID: "" });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("invalid or missing AWS_ACCESS_KEY_ID");
  });

  test.each(["0", "1.5"])(
    "rejects invalid retention days: %s",
    async (retentionDays) => {
      const result = await loadEnvironment({
        BACKUP_RETENTION_DAYS: retentionDays,
      });

      expect(result.exitCode).not.toBe(0);
    },
  );
});
