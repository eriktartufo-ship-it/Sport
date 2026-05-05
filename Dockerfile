# syntax=docker/dockerfile:1.7
# Sport — Next.js 16 standalone + Prisma SQLite + entrypoint con chown del volume.
# Build ottimizzato: BuildKit cache per npm, multi-stage, alpine.

FROM node:20-alpine AS base

# === Stage 1: deps ===
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# === Stage 2: builder ===
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# === Stage 3: runner ===
# L'entrypoint gira come root per fare chown del volume mounted (Docker monta
# i named volumes come root:root). Poi su-exec droppa i privilegi a nextjs
# prima di eseguire l'app.
FROM base AS runner
WORKDIR /app
RUN apk add --no-cache openssl wget su-exec

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Crea utente non-root (l'app girerà sotto questo utente, non come root)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

# Standalone bundle (include @prisma/client tracciato)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Schema Prisma + Prisma CLI (per `prisma db push` runtime al primo deploy)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Pre-create della cartella data (verrà sovrascritta dal mount del volume,
# ma serve come fallback se il volume non è settato).
RUN mkdir -p /app/prisma/data && chown -R nextjs:nodejs /app/prisma/data

# Entrypoint (gira come root, poi fa drop a nextjs via su-exec)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# NESSUN `USER nextjs` qui: l'entrypoint deve poter chown del volume montato
# come root da Docker, poi delega a su-exec per girare l'app come nextjs.

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
