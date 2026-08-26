FROM oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS base
WORKDIR /app

FROM base AS installer
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS builder

COPY --from=installer /temp/prod/node_modules node_modules
COPY . .

RUN bun run build

FROM debian:trixie-slim@sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132 AS runner

WORKDIR /app

ARG PG_VERSION="18"

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates postgresql-common && \
    yes "" | /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh && \
    apt-get install -y --no-install-recommends postgresql-client-${PG_VERSION} && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=backup:backup /app/postgres-s3-backup .

USER backup

CMD [ "./postgres-s3-backup" ]
