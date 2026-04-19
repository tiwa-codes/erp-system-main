const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function runMigration() {
  try {
    console.log('Starting migration...')
    
    // Step 1: Convert relationship column to text temporarily
    console.log('Step 1: Converting relationship column to text...')
    await prisma.$executeRaw`
      ALTER TABLE dependents 
      ALTER COLUMN relationship TYPE TEXT 
      USING relationship::text
    `

    // Step 2: Update CHILD values based on gender
    console.log('Step 2: Updating CHILD relationship values...')
    const updateResult = await prisma.$executeRaw`
      UPDATE dependents 
      SET relationship = CASE 
          WHEN gender::text = 'MALE' OR gender::text = 'M' THEN 'SON'
          WHEN gender::text = 'FEMALE' OR gender::text = 'F' THEN 'DAUGHTER'
          ELSE 'EXTRA_DEPENDENT'
      END
      WHERE relationship = 'CHILD'
    `
    console.log(`Updated ${updateResult} records`)

    // Step 3: Create new enum
    console.log('Step 3: Creating new RelationshipType enum...')
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RelationshipType_new') THEN
          CREATE TYPE "RelationshipType_new" AS ENUM ('SPOUSE', 'SON', 'DAUGHTER', 'PARENT', 'SIBLING', 'OTHER', 'EXTRA_DEPENDENT');
        END IF;
      END $$;
    `

    // Step 4: Update column to use new enum
    console.log('Step 4: Updating relationship column to use new enum...')
    await prisma.$executeRaw`
      ALTER TABLE dependents 
      ALTER COLUMN relationship TYPE "RelationshipType_new" 
      USING relationship::"RelationshipType_new"
    `

    // Step 5: Replace old enum
    console.log('Step 5: Replacing old enum...')
    await prisma.$executeRaw`DROP TYPE IF EXISTS "RelationshipType"`
    await prisma.$executeRaw`ALTER TYPE "RelationshipType_new" RENAME TO "RelationshipType"`

    // Step 6: Add preferred_provider_id column
    console.log('Step 6: Adding preferred_provider_id column...')
    await prisma.$executeRaw`
      ALTER TABLE dependents 
      ADD COLUMN IF NOT EXISTS preferred_provider_id TEXT
    `

    // Step 7: Add index
    console.log('Step 7: Creating index...')
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS dependents_preferred_provider_id_idx ON dependents(preferred_provider_id)
    `

    // Verify
    console.log('Verifying migration...')
    const verify = await prisma.$queryRaw`
      SELECT relationship, COUNT(*) as count 
      FROM dependents 
      GROUP BY relationship 
      ORDER BY count DESC
    `
    console.log('Relationship distribution:', verify)

    const columnCheck = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'dependents' 
      AND column_name = 'preferred_provider_id'
    `
    console.log('Column check:', columnCheck)

    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

