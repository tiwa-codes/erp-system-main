#!/bin/bash
# =============================================================
# ERP SYSTEM - STAGING DEPLOYMENT (rsync-based)
# Usage: ./scripts/deploy-staging.sh
# Prerequisites: SSH key at ~/.ssh/erp_deploy
# =============================================================

set -e

STAGING_HOST="root@167.99.59.53"
SSH_KEY="$HOME/.ssh/erp_deploy"
APP_DIR="/root/erp-system-staging"
PM2_APP="crownjewelhmo-staging"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAGING_PORT="3001"

echo "======================================"
echo "  ERP System - Staging Deployment"
echo "======================================"
echo ""

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  echo "Run: ssh-copy-id -i ~/.ssh/erp_deploy.pub root@167.99.59.53"
  exit 1
fi

echo "Local project: $LOCAL_DIR"
echo "Target server: $STAGING_HOST:$APP_DIR"
echo "Port: $STAGING_PORT"
echo ""

# Sync files to server via rsync (excludes heavy/generated folders)
echo "[1/4] Syncing files to staging server..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude 'uploads/*' \
  --exclude 'backups/*' \
  --exclude '*.log' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_DIR/" "$STAGING_HOST:$APP_DIR/"

echo ""
echo "[2/4] Installing dependencies..."
ssh -i "$SSH_KEY" "$STAGING_HOST" "
  set -e
  cd $APP_DIR
  echo '--- npm install ---'
  npm install --legacy-peer-deps
"

echo ""
echo "[3/4] Pushing database schema & building..."
ssh -i "$SSH_KEY" "$STAGING_HOST" "
  set -e
  cd $APP_DIR
  echo '--- prisma db push (staging database) ---'
  npx prisma db push --accept-data-loss
  echo '--- npm run build ---'
  npm run build
"

echo ""
echo "[4/4] Restarting PM2 (staging)..."
ssh -i "$SSH_KEY" "$STAGING_HOST" "
  pm2 delete $PM2_APP || true
  pm2 start 'npm start -- -p $STAGING_PORT' --name $PM2_APP --cwd $APP_DIR
  pm2 save
  sleep 3
  pm2 status
"

echo ""
echo "======================================"
echo "✓ Staging deployment complete!"
echo "✓ Visit: https://staging.crownjewelhmo.sbfy360.com"
echo "======================================"
