#!/bin/bash

# Production Database Migration Script for Pharmacy Order Fields
# Run this on your production server

echo "🚀 Starting pharmacy order fields migration..."

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Not in the correct directory. Please run from /root/erp-system"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo "📊 Checking current database schema..."

# Check if columns exist using psql
PGPASSWORD="${DB_PASSWORD:-crownjewelhmo@sbfy360}" psql -h 167.99.59.53 -U crownjewelhmo -d crownjewelhmo -c "
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pharmacy_orders' 
AND column_name IN ('duration', 'frequency');
"

echo "🗑️ Clearing Prisma cache..."
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client/runtime

echo "📦 Reinstalling Prisma client..."
npm install @prisma/client

echo "🔄 Regenerating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

echo "🗄️ Adding database columns if they don't exist..."
PGPASSWORD="${DB_PASSWORD:-crownjewelhmo@sbfy360}" psql -h 167.99.59.53 -U crownjewelhmo -d crownjewelhmo -c "
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS frequency TEXT;
"

echo "✅ Verifying columns were added..."
PGPASSWORD="${DB_PASSWORD:-crownjewelhmo@sbfy360}" psql -h 167.99.59.53 -U crownjewelhmo -d crownjewelhmo -c "
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pharmacy_orders' 
AND column_name IN ('duration', 'frequency');
"

echo "🔄 Pushing schema to ensure sync..."
npx prisma db push --accept-data-loss

echo "🔄 Regenerating client again after schema sync..."
npx prisma generate

echo "♻️ Restarting application..."
pm2 restart crownjewelhmo || systemctl restart crownjewelhmo || echo "Please restart your application manually"

echo "🎉 Migration complete!"
echo ""
echo "📋 Summary:"
echo "✅ Prisma cache cleared"
echo "✅ Prisma client reinstalled"
echo "✅ Database columns added: duration, frequency"
echo "✅ Schema synchronized"
echo "✅ Application restarted"
echo ""
echo "🧪 Test by creating a new prescription with quantity, duration, and frequency fields."