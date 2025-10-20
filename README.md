# Postgres S3 Backups

A simple utility to backup Postgres databases to S3-compatible services, built with [Bun](https://bun.sh/).

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/t4HonS?referralCode=7y-eBI)

## Features

- **Automated Backups:** Schedule backups using cron expressions.
- **S3-Compatible:** Works with AWS S3, Cloudflare R2, MinIO and other [S3-compatible services](https://bun.sh/docs/api/s3#support-for-s3-compatible-services).
- **Compression:** Compresses backups using Gzip for efficient storage.
- **Flexible:** Supports custom `pg_dump` options.
- **Run on Startup:** Option to run a backup immediately on startup.
- **Single Shot Mode:** Run once and exit, ideal for CI/CD pipelines.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of [Bun](https.bun.sh)
- You have a working [PostgreSQL](https://www.postgresql.org/) database.
- You have an S3-compatible storage service and your credentials.
- Or, you have [Docker](https://www.docker.com/) installed to run the utility in a containerized environment.

## Environment Variables

To configure the backup utility, you need to set the following environment variables. You can create a `.env` file in the root of the project based on the [`.env.example`](.env.example) file.

| Variable                | Description                                                                        | Default     |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------- |
| `AWS_ACCESS_KEY_ID`     | Your S3 access key ID.                                                             |             |
| `AWS_SECRET_ACCESS_KEY` | Your S3 secret access key.                                                         |             |
| `AWS_S3_BUCKET`         | The name of your S3 bucket.                                                        |             |
| `AWS_S3_REGION`         | The region of your S3 bucket.                                                      |             |
| `AWS_S3_ENDPOINT`       | The endpoint for your S3-compatible service (optional).                            |             |
| `BACKUP_DATABASE_URL`   | The connection URL for your PostgreSQL database.                                   |             |
| `BACKUP_CRON_SCHEDULE`  | The cron schedule for backups. See [crontab.guru](https://crontab.guru/) for help. | `0 0 * * *` |
| `BACKUP_FILE_PREFIX`    | The prefix for the backup file name.                                               | `backup`    |
| `BUCKET_SUBFOLDER`      | A subfolder within the bucket to store backups (optional).                         |             |
| `BACKUP_OPTIONS`        | Extra options to pass to the `pg_dump` command (optional).                         |             |
| `RUN_ON_STARTUP`        | Whether to run a backup on startup.                                                | `false`     |
| `SINGLE_SHOT_MODE`      | Whether to run a single backup and then exit.                                      | `false`     |

## Usage

1. **Install dependencies:**

```bash
bun install
```

2. **Set up your environment variables:**

Create a `.env` file in the root of the project and add the required environment variables.

3. **Run the backup utility:**

```bash
bun start
```

## Running with Docker

You can also run this utility using Docker. First, build the Docker image:

```bash
docker build -t postgres-s3-backups .
```

Then, you can run the backup utility using the following command. Remember to replace the placeholder values with your actual environment variables.

```bash
docker run --env-file .env postgres-s3-backups
```

## References and inspirations

- <https://github.com/railwayapp-templates/postgres-s3-backups>

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
