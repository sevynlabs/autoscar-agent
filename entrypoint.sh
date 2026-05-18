#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
if npx prisma migrate deploy; then
  echo "[entrypoint] Migrations applied."
else
  echo "[entrypoint] migrate deploy failed — reconciling schema with prisma db push (additive, no data loss)..."
  # db push without --accept-data-loss only applies additive changes (e.g.
  # new columns) and refuses destructive ones, so it can't drop data. With
  # `set -e`, a hard failure here stops the boot loudly instead of starting
  # the app against an out-of-sync database (which is what masked the
  # missing webchat* columns before).
  npx prisma db push --skip-generate
  echo "[entrypoint] Schema reconciled via db push."
fi

echo "[entrypoint] Starting app..."
exec node dist/main.js
