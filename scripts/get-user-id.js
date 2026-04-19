const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getUserID() {
  try {
    const user = await prisma.user.findFirst()
    console.log('First user ID:', user?.id)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getUserID()
