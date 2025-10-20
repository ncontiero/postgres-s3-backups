import { createEnv } from "@t3-oss/env-core";
import { validateCronExpression } from "cron";
import { z } from "zod";

const booleanSchema = z.string().transform((val) => {
  return val.toLowerCase() === "true" || val === "1";
});

export const env = createEnv({
  server: {
    AWS_ACCESS_KEY_ID: z.string({
      error: "invalid or missing AWS_ACCESS_KEY_ID",
    }),
    AWS_SECRET_ACCESS_KEY: z.string({
      error: "invalid or missing AWS_SECRET_ACCESS_KEY",
    }),
    S3_BUCKET: z.string({ error: "invalid or missing S3_BUCKET" }),
    S3_REGION: z.string({ error: "invalid or missing S3_REGION" }),
    S3_ENDPOINT: z.string().optional(),

    DATABASE_URL: z.url({ error: "invalid or missing DATABASE_URL" }),

    BACKUP_CRON_SCHEDULE: z
      .string()
      .refine((val) => validateCronExpression(val).valid, {
        error: "invalid BACKUP_CRON_SCHEDULE format",
      })
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
