FROM oven/bun:1.3.0-slim AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS release

ARG PG_VERSION="18"

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg && \
    curl -o /etc/apt/keyrings/pgdg-archive-keyring.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    sh -c 'echo "deb [signed-by=/etc/apt/keyrings/pgdg-archive-keyring.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list' && \
    apt-get update && \
    apt-get install -y postgresql-client-${PG_VERSION} && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=install /temp/prod/node_modules node_modules
COPY . .

USER bun

CMD [ "bun", "start" ]
