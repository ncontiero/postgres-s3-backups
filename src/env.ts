import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const booleanSchema = z.string().transform((val) => {
  return val.toLowerCase() === "true" || val === "1";
});

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_S3_BUCKET: z.string(),
    AWS_S3_REGION: z.string(),
    AWS_S3_ENDPOINT: z.string().optional(),

    BACKUP_DATABASE_URL: z.url(),
    BACKUP_CRON_SCHEDULE: z
      .string()
      .regex(/(\d+|\*) (\d+|\*) (\d+|\*) (\d+|\*) (\d+|\*)/)
      .default("0 0 * * *"),
    BACKUP_FILE_PREFIX: z.string().default("backup"),
    BUCKET_SUBFOLDER: z.string().optional(),
    BACKUP_OPTIONS: z.string().optional(),

    RUN_ON_STARTUP: booleanSchema.default(false),
    SINGLE_SHOT_MODE: booleanSchema.default(false),
  },

  runtimeEnv: Bun.env,
  emptyStringAsUndefined: true,
});
