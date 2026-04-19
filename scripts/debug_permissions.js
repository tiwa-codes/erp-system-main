const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const roleName = 'CLAIMS_PROCESSOR' // Or whatever role you want to test
  console.log(`Checking permissions for role: ${roleName}`)

  const roleRecord = await prisma.role.findFirst({
    where: {
      OR: [
        { name: roleName },
        { name: { contains: roleName, mode: 'insensitive' } }
      ]
    }
  })

  if (!roleRecord) {
    console.log('Role not found in DB')
    return
  }

  console.log(`Found Role: ${roleRecord.name} (ID: ${roleRecord.id})`)

  const permissions = await prisma.permission.findMany({
    where: {
      role_id: roleRecord.id,
      allowed: true
    }
  })

  console.log('--- Permissions in DB ---')
  permissions.forEach(p => {
    console.log(`${p.module}:${p.action} (Submodule: ${p.submodule || 'N/A'})`)
  })

  const hasManageMemos = permissions.some(p => p.action === 'manage_memos')
  console.log(`\nHas manage_memos permission? ${hasManageMemos}`)

  if (!hasManageMemos) {
    console.log('\n!!! manage_memos is MISSING !!!')
  } else {
    console.log('\n✅ manage_memos is PRESENT')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
