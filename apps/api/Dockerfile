# ── Stage 1: Install dependencies ──────────────────────
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
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
COPY apps/api/ ./apps/api/
COPY packages/database/ ./packages/database/
COPY packages/types/ ./packages/types/

# Build types package first (runtime exports: PRIZE_LABELS, PRIZE_VALUES)
RUN cd packages/types && npx tsc

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# Build API (TypeScript → dist/)
RUN cd apps/api && npx tsc

# ── Stage 3: Production runner ────────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

# Copy built output
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/database/prisma ./prisma
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/types/package.json ./packages/types/package.json

# Copy entrypoint (strip Windows CRLF line endings)
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p uploads/selfies uploads/cards uploads/results uploads/templates

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
