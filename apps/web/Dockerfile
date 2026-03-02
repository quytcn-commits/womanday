# ── Stage 1: Build (install + compile in one stage) ─────
# npm workspaces create symlinks during install; COPY between
# Docker stages does NOT preserve symlinks, so we must install
# and build in the same stage for standalone file-tracing to work.
FROM node:20-slim AS build
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install all dependencies (monorepo — workspace symlinks intact)
RUN npm ci

# Copy source
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

# Debug: verify standalone output structure
RUN echo "=== Standalone structure ===" && \
    ls -la apps/web/.next/standalone/ && \
    echo "=== node_modules/next exists? ===" && \
    ls -d apps/web/.next/standalone/node_modules/next 2>/dev/null && echo "YES at root" || true && \
    ls -d apps/web/.next/standalone/apps/web/node_modules/next 2>/dev/null && echo "YES at apps/web" || true && \
    find apps/web/.next/standalone -name "next" -maxdepth 4 -type d || true

# ── Stage 2: Production runner ────────────────────────
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
