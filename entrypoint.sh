#!/bin/sh
echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy
echo "[entrypoint] Starting app..."
exec node dist/main.js
