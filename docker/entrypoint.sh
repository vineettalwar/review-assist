#!/bin/sh
set -e

if [ ! -f .dev.vars ]; then
  echo "Missing .dev.vars: copy .dev.vars.example to .dev.vars and set ADMIN_PASSWORD and SESSION_SECRET." >&2
  exit 1
fi

# Both are idempotent, so they run on every start.
bun run db:migrate:local
bun run db:seed:local

exec bunx next dev --turbopack -H 0.0.0.0 -p 3000
