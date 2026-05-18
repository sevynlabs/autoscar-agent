#!/bin/sh
# Availability first: a migration problem must NEVER stop the app from
# booting (a crash loop takes the whole CRM down → 504). So no `set -e`
# here — we attempt to sync the schema but always start the app.

echo "[entrypoint] Running database migrations..."
if npx prisma migrate deploy; then
  echo "[entrypoint] Migrations applied."
else
  echo "[entrypoint] migrate deploy failed — attempting additive reconcile (prisma db push)..."
  if npx prisma db push --skip-generate; then
    echo "[entrypoint] Schema reconciled via db push."
  else
    echo "[entrypoint] WARNING: db push failed too — starting anyway; schema may be out of sync."
  fi
fi

echo "[entrypoint] Starting app..."
exec node dist/main.js
