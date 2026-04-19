const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getOrgID() {
  try {
    const org = await prisma.organization.findFirst()
    console.log('First org ID:', org?.id)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getOrgID()
