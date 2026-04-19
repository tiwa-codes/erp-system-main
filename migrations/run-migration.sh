#!/bin/bash
# Migration script to fix dependents table and enum
# This script can be run on both local and production

echo "🚀 Starting dependents table migration..."
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Using direct SQL method..."
    
    # Direct SQL method
    psql $DATABASE_URL <<EOF
-- Step 1: Update CHILD values
UPDATE dependents 
SET relationship = CASE 
    WHEN gender = 'MALE' OR gender = 'M' THEN 'SON'::text
    WHEN gender = 'FEMALE' OR gender = 'F' THEN 'DAUGHTER'::text
    ELSE 'EXTRA_DEPENDENT'::text
END
WHERE relationship = 'CHILD';

-- Step 2: Create new enum
DO \$\$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RelationshipType_new') THEN
    CREATE TYPE "RelationshipType_new" AS ENUM ('SPOUSE', 'SON', 'DAUGHTER', 'PARENT', 'SIBLING', 'OTHER', 'EXTRA_DEPENDENT');
  END IF;
END \$\$;

-- Step 3: Update column
ALTER TABLE dependents 
ALTER COLUMN relationship TYPE "RelationshipType_new" 
USING relationship::text::"RelationshipType_new";

-- Step 4: Replace enum
DROP TYPE IF EXISTS "RelationshipType";
ALTER TYPE "RelationshipType_new" RENAME TO "RelationshipType";

-- Step 5: Add column
ALTER TABLE dependents 
ADD COLUMN IF NOT EXISTS preferred_provider_id TEXT;

-- Step 6: Add index
CREATE INDEX IF NOT EXISTS dependents_preferred_provider_id_idx ON dependents(preferred_provider_id);

-- Verify
SELECT relationship, COUNT(*) as count 
FROM dependents 
GROUP BY relationship 
ORDER BY count DESC;
EOF
else
    echo "✅ Using Node.js migration script..."
    node migrations/run-dependents-migration.js
fi

echo ""
echo "✅ Migration complete! Please run: npx prisma generate"
