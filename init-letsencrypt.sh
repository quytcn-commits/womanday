#!/bin/bash
# ── Let's Encrypt SSL Setup for womanday.nhatquy.com ──
# Run once on VPS: bash init-letsencrypt.sh

set -e

DOMAIN="womanday.nhatquy.com"
EMAIL="admin@nhatquy.com"  # Change this to your email
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "🔐 Setting up SSL for $DOMAIN..."

# Step 1: Create dummy certificate so nginx can start
echo "📝 Creating temporary self-signed certificate..."
$COMPOSE run --rm --entrypoint "" certbot sh -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=$DOMAIN'
"

# Step 2: Start nginx with dummy cert
echo "🚀 Starting nginx..."
$COMPOSE up -d nginx

# Step 3: Delete dummy certificate
echo "🗑️  Removing temporary certificate..."
$COMPOSE run --rm --entrypoint "" certbot sh -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN
  rm -rf /etc/letsencrypt/archive/$DOMAIN
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf
"

# Step 4: Request real certificate from Let's Encrypt
echo "🌐 Requesting real certificate from Let's Encrypt..."
$COMPOSE run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 5: Reload nginx with real certificate
echo "🔄 Reloading nginx with real SSL certificate..."
$COMPOSE exec nginx nginx -s reload

echo ""
echo "✅ SSL setup complete!"
echo "🌸 Visit: https://$DOMAIN"
