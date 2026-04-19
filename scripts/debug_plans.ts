
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const plans = await prisma.plan.findMany({
        select: { id: true, name: true, classification: true }
    });
    console.log("Total Plans:", plans.length);
    plans.forEach(p => {
        console.log(`[${p.classification}] ${p.name} (${p.id})`);
    });

    // Categorize
    const sme = plans.filter(p => p.classification === 'SME');
    const retail = plans.filter(p => p.classification === 'RETAIL');
    const corp = plans.filter(p => p.classification === 'CORPORATE');
    const general = plans.filter(p => p.classification === 'GENERAL');

    console.log('--- Stats ---');
    console.log('SME:', sme.length);
    console.log('RETAIL:', retail.length);
    console.log('CORPORATE:', corp.length);
    console.log('GENERAL:', general.length);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
