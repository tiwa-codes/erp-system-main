
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Reset all to GENERAL first? No, keep existing if manually set (but none are).

    // Update RETAIL
    const retailUpdate = await prisma.plan.updateMany({
        where: {
            OR: [
                { name: { contains: 'INDIVIDUAL', mode: 'insensitive' } },
                { name: { contains: 'FAMILY', mode: 'insensitive' } }
            ]
        },
        data: { classification: 'RETAIL' }
    });
    console.log(`Updated ${retailUpdate.count} plans to RETAIL`);

    // Update SME (If name has SME or just assign some if missing?)
    // For now, let's assume SME plans might be named 'SME' or 'Business'.
    const smeUpdate = await prisma.plan.updateMany({
        where: {
            name: { contains: 'SME', mode: 'insensitive' }
        },
        data: { classification: 'SME' }
    });
    console.log(`Updated ${smeUpdate.count} plans to SME`);

    // Update CORPORATE
    const corpUpdate = await prisma.plan.updateMany({
        where: {
            name: { contains: 'CORPORATE', mode: 'insensitive' }
        },
        data: { classification: 'CORPORATE' }
    });
    console.log(`Updated ${corpUpdate.count} plans to CORPORATE`);

    // Check counts
    const counts = await prisma.plan.groupBy({
        by: ['classification'],
        _count: true
    });
    console.log(counts);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
