#!/bin/sh
set -e

# Il volume Docker è di solito montato come root:root al primo avvio.
# nextjs (uid 1001) non potrebbe scrivere su /app/prisma/data → prisma db push
# fallirebbe con "unable to open database file". Risolto con chown qui.
echo "[entrypoint] Assicuro permessi sul volume /app/prisma/data..."
mkdir -p /app/prisma/data
chown -R nextjs:nodejs /app/prisma/data

echo "[entrypoint] Sincronizzo schema DB SQLite (non distruttivo, prisma db push)..."
su-exec nextjs:nodejs node /app/node_modules/prisma/build/index.js db push --skip-generate

echo "[entrypoint] Avvio Next.js standalone su porta ${PORT:-3000}..."
exec su-exec nextjs:nodejs node /app/server.js
