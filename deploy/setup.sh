#!/bin/bash
# Pattani FC — one-shot deploy script
# Runs Phase 2 (Postgres) → npm install → build → PM2 start
# Assumes Phase 1 done (node, npm, pm2, nginx, postgresql, git installed)
#
# Usage from within cloned repo:
#   bash deploy/setup.sh

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="pattanifc.co"

cd "$APP_DIR"

echo ""
echo "════════════════════════════════════════════════"
echo "   Pattani FC — Deploy Script"
echo "   App dir: $APP_DIR"
echo "   Domain:  $DOMAIN"
echo "════════════════════════════════════════════════"

# ────────────────────────────────────────────────
# Preflight
# ────────────────────────────────────────────────
for cmd in node npm pm2 nginx psql git openssl printf; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Missing tool: $cmd — run Phase 1 install first"
    exit 1
  fi
done
echo "✓ All required tools present"

# ────────────────────────────────────────────────
# Phase 2 — Postgres user + secrets
# ────────────────────────────────────────────────
echo ""
echo "── [1/6] PostgreSQL setup ──"

USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT usename FROM pg_user WHERE usename='pattani';" | grep -c pattani || true)
SECRETS_EXISTS=$([ -f /root/.secrets/pattani-fc.env ] && echo 1 || echo 0)

if [ "$USER_EXISTS" = "1" ] && [ "$SECRETS_EXISTS" = "1" ]; then
  echo "✓ Postgres user + secrets file already exist — skipping"
  # Idempotent: ensure Payload schema exists even for pre-existing installs
  sudo -u postgres psql -d pattani_ticket -c "CREATE SCHEMA IF NOT EXISTS payload AUTHORIZATION pattani;" >/dev/null
else
  # ถ้าสถานะไม่สอดคล้อง (user มีแต่ secrets หาย หรือกลับกัน) — reset ทั้งคู่
  if [ "$USER_EXISTS" = "1" ]; then
    echo "⚠️ User 'pattani' exists but secrets file missing — resetting"
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS pattani_ticket;"
    sudo -u postgres psql -c "DROP USER IF EXISTS pattani;"
  fi

  DB_PASSWORD=$(openssl rand -hex 24)
  SESSION_SECRET=$(openssl rand -base64 32)
  PAYLOAD_SECRET=$(openssl rand -base64 32)
  SEED_ADMIN_PASSWORD=$(openssl rand -hex 12)

  sudo -u postgres psql -c "CREATE USER pattani WITH PASSWORD '$DB_PASSWORD';"
  sudo -u postgres psql -c "CREATE DATABASE pattani_ticket OWNER pattani;"
  sudo -u postgres psql -d pattani_ticket -c "GRANT ALL ON SCHEMA public TO pattani;"
  sudo -u postgres psql -d pattani_ticket -c "ALTER SCHEMA public OWNER TO pattani;"
  # Payload CMS uses schemaName: "payload" — schema must exist before push
  sudo -u postgres psql -d pattani_ticket -c "CREATE SCHEMA IF NOT EXISTS payload AUTHORIZATION pattani;"

  mkdir -p /root/.secrets && chmod 700 /root/.secrets
  printf 'DB_PASSWORD=%s\nSESSION_SECRET=%s\nPAYLOAD_SECRET=%s\nSEED_ADMIN_PASSWORD=%s\nDATABASE_URL="postgresql://pattani:%s@localhost:5432/pattani_ticket?schema=public"\n' \
    "$DB_PASSWORD" "$SESSION_SECRET" "$PAYLOAD_SECRET" "$SEED_ADMIN_PASSWORD" "$DB_PASSWORD" \
    > /root/.secrets/pattani-fc.env
  chmod 600 /root/.secrets/pattani-fc.env

  echo "✓ Postgres user + secrets created"
  echo ""
  echo "  ⚠️ IMPORTANT — Backup these secrets to password manager NOW:"
  echo "  ─────────────────────────────────────────────────────"
  cat /root/.secrets/pattani-fc.env
  echo "  ─────────────────────────────────────────────────────"
  echo ""
fi

# ────────────────────────────────────────────────
# Install libvips (Sharp dependency)
# ────────────────────────────────────────────────
echo ""
echo "── [2/6] Install libvips-dev ──"
if dpkg -l libvips-dev >/dev/null 2>&1; then
  echo "✓ libvips-dev already installed"
else
  DEBIAN_FRONTEND=noninteractive apt install -y libvips-dev
  echo "✓ libvips-dev installed"
fi

# ────────────────────────────────────────────────
# Create .env.local
# ────────────────────────────────────────────────
echo ""
echo "── [3/6] Create .env.local ──"

source /root/.secrets/pattani-fc.env
printf 'DATABASE_URL="postgresql://pattani:%s@localhost:5432/pattani_ticket?schema=public"\nSESSION_SECRET="%s"\nPAYLOAD_SECRET="%s"\nPAYLOAD_PUBLIC_SERVER_URL="https://%s"\nSEED_ADMIN_EMAIL="admin@%s"\nSEED_ADMIN_PASSWORD="%s"\nNODE_ENV="production"\nPORT=3000\n' \
  "$DB_PASSWORD" "$SESSION_SECRET" "$PAYLOAD_SECRET" "$DOMAIN" "$DOMAIN" "$SEED_ADMIN_PASSWORD" \
  > "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"

# Prisma CLI reads .env (ไม่ใช่ .env.local) — copy ให้อีกไฟล์
cp "$APP_DIR/.env.local" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
echo "✓ .env + .env.local written"

# ────────────────────────────────────────────────
# npm install + prisma
# ────────────────────────────────────────────────
echo ""
echo "── [4/6] npm ci (this takes 5-8 minutes) ──"
npm ci

echo ""
echo "── Prisma generate + migrate + seed ──"
npx prisma generate
npx prisma migrate deploy
# Seed admin user + sample matches (idempotent via upsert)
npm run db:seed

# ────────────────────────────────────────────────
# Build
# ────────────────────────────────────────────────
echo ""
echo "── [5/6] Building Next.js (3-5 minutes) ──"
NODE_OPTIONS="--max-old-space-size=8192" npm run build

# Payload schema push now happens at runtime via onInit in payload.config.ts
# (Payload skips auto-push when NODE_ENV=production; onInit is unconditional).
# ────────────────────────────────────────────────
# PM2
# ────────────────────────────────────────────────
echo ""
echo "── [6/6] Start with PM2 ──"

pm2 delete pattani-fc 2>/dev/null || true
pm2 start npm --name pattani-fc -- start
sleep 6
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ────────────────────────────────────────────────
# Verify
# ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "   Verification"
echo "════════════════════════════════════════════════"
pm2 status
echo ""
echo "── curl localhost:3000 (Next.js direct) ──"
sleep 2
curl -sI http://localhost:3000 | head -3 || echo "❌ Next.js not responding"
echo ""
echo "── curl via nginx (Host: $DOMAIN) ──"
curl -sI -H "Host: $DOMAIN" http://localhost | head -3 || echo "❌ nginx proxy failed"
echo ""
echo "════════════════════════════════════════════════"
echo "   ✓ DEPLOY COMPLETE"
echo "   → Test in browser: http://$DOMAIN"
echo "════════════════════════════════════════════════"
