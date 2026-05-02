#!/bin/sh
set -e

echo "[entrypoint] Sincronizzo schema DB SQLite (non distruttivo, prisma db push)..."
node /app/node_modules/prisma/build/index.js db push --skip-generate

echo "[entrypoint] Avvio Next.js standalone su porta ${PORT:-3000}..."
exec node /app/server.js
