FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS base
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

RUN case "$PG_VERSION" in \
      14|15|16|17|18) ;; \
      *) echo "Unsupported PostgreSQL version: $PG_VERSION (expected 14-18)." >&2; exit 1 ;; \
    esac && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates postgresql-common && \
    yes "" | /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh && \
    apt-get install -y --no-install-recommends postgresql-client-${PG_VERSION} && \
    apt-get purge -y --auto-remove postgresql-common && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=backup:backup /app/postgres-s3-backup .

USER backup

CMD [ "./postgres-s3-backup" ]
