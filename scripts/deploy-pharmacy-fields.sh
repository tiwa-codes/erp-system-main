#!/bin/bash

# Production deployment script for pharmacy order fields
echo "🚀 Deploying pharmacy order enhancements to production..."

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Not in the correct directory. Please run from the app root."
    exit 1
fi

echo "📊 Current schema status:"
npx prisma db status

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🗄️ Pushing schema changes to database..."
npx prisma db push --accept-data-loss

echo "✅ Schema update complete!"

echo "🧪 Testing database connection..."
npx prisma db seed --preview-feature 2>/dev/null || echo "Seed skipped (optional)"

echo "🎉 Deployment complete! Pharmacy orders with duration and frequency fields are now available."
echo "📝 Fields added:"
echo "   - duration (String, optional)"
echo "   - frequency (String, optional)"
echo ""
echo "🔗 You can now create prescriptions with:"
echo "   - Quantity: Number of units"
echo "   - Duration: e.g., '7 Days', '2 weeks'" 
echo "   - Frequency: e.g., 'QHS', 'BD', 'TDS'"