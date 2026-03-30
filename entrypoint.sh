#!/bin/sh
echo "[entrypoint] Syncing database schema..."
timeout 30 npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[entrypoint] prisma db push failed or timed out, continuing..."
echo "[entrypoint] Starting app..."
exec node dist/main.js
