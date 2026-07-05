#!/bin/sh
set -e

# Il volume Docker è di solito montato come root:root al primo avvio.
# nextjs (uid 1001) non potrebbe scrivere su /app/prisma/data → prisma db push
# fallirebbe con "unable to open database file". Risolto con chown qui.
echo "[entrypoint] Assicuro permessi sul volume /app/prisma/data..."
mkdir -p /app/prisma/data
chown -R nextjs:nodejs /app/prisma/data

echo "[entrypoint] Sincronizzo schema DB SQLite (prisma db push)..."
# --accept-data-loss: necessario per applicare in automatico i cambi di colonna
# NON additivi (es. rename/type-change) su una tabella già popolata. Senza il
# flag, `db push` è interattivo e in un entrypoint non-interattivo fallisce
# (set -e -> container esce -> Traefik 404). Su questo tracker single-tenant è
# accettabile: prisma ricrea la tabella preservando le righe delle colonne
# ancora presenti; solo i valori delle colonne rimosse vengono persi.
su-exec nextjs:nodejs node /app/node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss

echo "[entrypoint] Avvio Next.js standalone su porta ${PORT:-3000}..."
exec su-exec nextjs:nodejs node /app/server.js
