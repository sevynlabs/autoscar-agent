#!/bin/sh
# Availability first: a migration problem must NEVER stop the app from
# booting (a crash loop takes the whole CRM down → 504). So no `set -e`
# here — we attempt to sync the schema but always start the app.

# Last migration that was already reflected in production when it was first
# baselined (the database was created with `db push`, so it had no
# _prisma_migrations history). Migrations up to and including this one are
# marked as applied; later ones run normally through `migrate deploy`.
BASELINE_MIGRATION="20261110_add_seller_notification_log"

# One-time baseline for a database whose schema exists but has no migration
# history (Prisma error P3005). Only proceeds when the live schema matches
# schema.prisma exactly, so nothing is marked applied that isn't really there.
baseline() {
  echo "[entrypoint] P3005: schema exists without migration history — baselining."
  if ! npx prisma db push --skip-generate; then
    echo "[entrypoint] Baseline aborted: db push failed."
    return 1
  fi
  npx prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --exit-code > /dev/null
  diff_status=$?
  if [ "$diff_status" -ne 0 ]; then
    echo "[entrypoint] Baseline aborted: live schema differs from schema.prisma (migrate diff exit $diff_status)."
    return 1
  fi
  for dir in $(ls -d prisma/migrations/*/ | sort); do
    name=$(basename "$dir")
    out=$(npx prisma migrate resolve --applied "$name" 2>&1)
    if [ $? -eq 0 ]; then
      echo "[entrypoint]   baselined $name"
    elif echo "$out" | grep -q "P3008"; then
      echo "[entrypoint]   $name already recorded"
    else
      echo "$out"
      echo "[entrypoint] Baseline aborted at $name."
      return 1
    fi
    [ "$name" = "$BASELINE_MIGRATION" ] && break
  done
  echo "[entrypoint] Baseline done; applying newer migrations..."
  npx prisma migrate deploy
}

echo "[entrypoint] Running database migrations..."
deploy_out=$(npx prisma migrate deploy 2>&1)
deploy_status=$?
echo "$deploy_out"

if [ "$deploy_status" -eq 0 ]; then
  echo "[entrypoint] Migrations applied."
elif echo "$deploy_out" | grep -q "P3005" && baseline; then
  echo "[entrypoint] Migrations applied after baseline."
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
