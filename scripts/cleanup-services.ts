
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting service cleanup...')

    try {
        const deleted = await prisma.serviceType.deleteMany({})
        console.log(`Successfully deleted ${deleted.count} service types.`)
    } catch (error) {
        console.error('Error deleting services:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
