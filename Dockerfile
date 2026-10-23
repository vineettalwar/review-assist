# Local development image. Production runs on Cloudflare Workers (`bun run deploy`), not Docker.
# Node is the runtime for next/wrangler; bun is the package manager and script runner.
FROM oven/bun:1.4.4 AS bun

FROM node:22-bookworm-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx \
 && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    WRANGLER_SEND_METRICS=false \
    CI=true
EXPOSE 3000
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
