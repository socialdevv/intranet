#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy
fi

seed_mode="${RUN_DB_SEED:-auto}"

if [ "$seed_mode" = "true" ]; then
  echo "Seeding database (RUN_DB_SEED=true)..."
  npx tsx prisma/seed.ts
elif [ "$seed_mode" = "auto" ]; then
  if node docker/check-seed-needed.mjs; then
    echo "Database is empty. Applying baseline seed data..."
    npx tsx prisma/seed.ts
  else
    echo "Database already contains users. Skipping seed (RUN_DB_SEED=auto)."
  fi
fi

exec node server/dist/index.js
