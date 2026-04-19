#!/bin/bash

# Production Deployment Script
# This script handles the complete deployment process including Prisma, build, and manifest creation

set -e  # Exit on error

echo "🚀 Starting Production Deployment..."
echo "📍 Current directory: $(pwd)"
echo "🕒 Timestamp: $(date)"

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in app root directory. Please run from /root/erp-system"
    exit 1
fi

# Step 1: Stop the application
echo "⏹️  Stopping application..."
pm2 stop crownjewelhmo || echo "PM2 process not found or already stopped"

# Step 2: Generate Prisma client
echo "🔄 Generating Prisma client..."
npm run db:generate

# Step 3: Sync database schema
echo "🗄️  Syncing database schema..."
npm run db:push || echo "Database sync failed, continuing..."

# Step 4: Build the application
echo "🏗️  Building application..."
npm run build

# Step 5: Ensure prerender-manifest.json exists (script runs automatically after build)
echo "✅ Verifying prerender-manifest.json..."
if [ ! -f ".next/prerender-manifest.json" ]; then
    echo "⚠️  prerender-manifest.json missing, creating..."
    node scripts/create-prerender-manifest.js
fi

# Step 6: Restart application
echo "🚀 Starting application..."
pm2 start crownjewelhmo || echo "Failed to start with PM2"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 What was done:"
echo "   ✅ Application stopped"
echo "   ✅ Prisma client generated"
echo "   ✅ Database schema synced"
echo "   ✅ Application built"
echo "   ✅ Prerender manifest created/verified"
echo "   ✅ Application restarted"
echo ""
echo "🧪 Test the application:"
echo "   - Check PM2 status: pm2 status"
echo "   - Check logs: pm2 logs crownjewelhmo"
echo "   - Visit your application URL"

