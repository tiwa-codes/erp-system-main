
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find a user to attribute to
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No users found to set as creator");
        process.exit(1);
    }

    const plans = [
        { name: 'CORPORATE BRONZE PLAN', classification: 'CORPORATE', plan_type: 'CORPORATE', premium_amount: 50000, annual_limit: 500000, code: 'CORP-BRONZE' },
        { name: 'CORPORATE SILVER PLAN', classification: 'CORPORATE', plan_type: 'CORPORATE', premium_amount: 75000, annual_limit: 1000000, code: 'CORP-SILVER' },
        { name: 'CORPORATE GOLD PLAN', classification: 'CORPORATE', plan_type: 'CORPORATE', premium_amount: 120000, annual_limit: 2500000, code: 'CORP-GOLD' },
    ];

    for (const p of plans) {
        const exists = await prisma.plan.findFirst({ where: { name: p.name } });
        if (!exists) {
            await prisma.plan.create({
                data: {
                    name: p.name,
                    plan_id: p.code,
                    classification: p.classification as any,
                    plan_type: p.plan_type as any,
                    premium_amount: p.premium_amount,
                    annual_limit: p.annual_limit,
                    description: 'Standard Corporate Plan',
                    status: 'ACTIVE',
                    created_by_id: user.id
                }
            });
            console.log(`Created ${p.name}`);
        } else {
            if (exists.classification !== 'CORPORATE') {
                await prisma.plan.update({
                    where: { id: exists.id },
                    data: { classification: 'CORPORATE' }
                });
                console.log(`Updated ${p.name} to CORPORATE`);
            } else {
                console.log(`Skipped ${p.name} (Exists)`);
            }
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
