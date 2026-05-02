# syntax=docker/dockerfile:1.7
# Sport — Next.js 16 standalone + Prisma SQLite + entrypoint che sincronizza lo schema.
# Build ottimizzato: BuildKit cache per npm, multi-stage, alpine.

FROM node:20-alpine AS base

# === Stage 1: deps ===
# Installa SOLO le dipendenze. Cache mount BuildKit riusa ~/.npm tra build.
# `--ignore-scripts` salta postinstall (prisma generate qui fallirebbe perché
# lo schema non è ancora copiato; lo faremo nel builder).
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# === Stage 2: builder ===
# Compila Next.js standalone + genera Prisma client.
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# === Stage 3: runner ===
# Immagine finale minimale: solo standalone bundle + prisma CLI per db push.
FROM base AS runner
WORKDIR /app
RUN apk add --no-cache openssl wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public assets
COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

# Standalone bundle (include @prisma/client tracciato + tutte le deps tracciate)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Schema Prisma + Prisma CLI per `prisma db push` all'avvio (necessario al primo
# avvio per creare le tabelle nel volume sqlite-data vuoto).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint: sincronizza schema poi avvia Next.js
COPY --chown=nextjs:nodejs docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
