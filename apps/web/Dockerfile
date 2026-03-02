# ── Stage 1: Install dependencies ──────────────────────
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install all dependencies (monorepo)
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────
FROM node:20-slim AS build
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY package.json turbo.json ./
COPY apps/web/ ./apps/web/
COPY packages/types/ ./packages/types/

# Build types package first
RUN cd packages/types && npx tsc

# NEXT_PUBLIC_* vars must be set at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Build Next.js (standalone output with monorepo root tracing)
RUN cd apps/web && npx next build

# ── Stage 3: Production runner ────────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (preserves monorepo structure via outputFileTracingRoot)
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

# Ensure server.js is at expected path (handle with/without outputFileTracingRoot)
RUN if [ ! -f "apps/web/server.js" ] && [ -f "server.js" ]; then \
      mkdir -p apps/web && cp server.js apps/web/server.js; \
    fi
RUN ls -la apps/web/server.js || (echo "ERROR: server.js not found!" && find /app -name "server.js" && exit 1)

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
