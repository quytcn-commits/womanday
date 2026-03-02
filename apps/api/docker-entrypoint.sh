#!/bin/sh
set -e

echo "🔄 Syncing database schema..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

echo "🌸 Starting WomanDay API..."
exec node dist/index.js
