import { createEnv } from "@t3-oss/env-core";
import * as z from "zod/mini";

const booleanSchema = z.pipe(
  z.string(),
  z.transform((val: string) => val.toLowerCase() === "true" || val === "1"),
);

function isValidCronExpression(value: string) {
  try {
    return Bun.cron.parse(value) !== null;
  } catch {
    return false;
  }
}

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
    S3_ENDPOINT: z.optional(z.string()),

    DATABASE_URL: z.url({ error: "invalid or missing DATABASE_URL" }),

    BACKUP_CRON_SCHEDULE: z._default(
      z.string().check(
        z.refine(isValidCronExpression, {
          error: "invalid BACKUP_CRON_SCHEDULE format",
        }),
      ),
      "0 0 * * *",
    ),
    BACKUP_FILE_PREFIX: z._default(z.string(), "backup"),
    BACKUP_RETENTION_DAYS: z.optional(
      z.pipe(z.coerce.number(), z.int().check(z.minimum(1))),
    ),
    BUCKET_SUBFOLDER: z.optional(z.string()),
    BACKUP_OPTIONS: z.optional(z.string()),

    RUN_ON_STARTUP: z._default(booleanSchema, false),
    SINGLE_SHOT_MODE: z._default(booleanSchema, false),
  },

  runtimeEnv: Bun.env,
  emptyStringAsUndefined: true,
});
