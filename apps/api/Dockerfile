# ── Stage 1: Install dependencies ──────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
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
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules 2>/dev/null || true

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
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Copy built output
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/database/prisma ./prisma
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/types/package.json ./packages/types/package.json

# Copy entrypoint
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p uploads/selfies uploads/cards uploads/results uploads/templates

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
