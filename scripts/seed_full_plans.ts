
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();
    if (!user) { console.error("No user found"); process.exit(1); }

    const TIERS = ['SILVER', 'GOLD', 'DIAMOND', 'PLATINUM'];
    const TYPES = ['INDIVIDUAL', 'FAMILY'];
    const CLASSIFICATIONS = ['SME', 'RETAIL', 'CORPORATE'];

    const BASE_PRICES = {
        SILVER: 50000,
        GOLD: 120000,
        DIAMOND: 250000,
        PLATINUM: 500000
    };

    const MULTIPLIERS = {
        INDIVIDUAL: 1,
        FAMILY: 4
    };

    for (const classification of CLASSIFICATIONS) {
        for (const tier of TIERS) {
            for (const type of TYPES) {
                const name = `${tier} ${type} ${classification}`;
                // Generate a code e.g. RET-SILV-IND
                const code = `${classification.substring(0, 3)}-${tier.substring(0, 4)}-${type.substring(0, 3)}`.toUpperCase();

                const price = (BASE_PRICES[tier as keyof typeof BASE_PRICES] || 50000) * (MULTIPLIERS[type as keyof typeof MULTIPLIERS] || 1);
                const limit = price * 10;

                // Map PlanType
                let planType = 'INDIVIDUAL';
                if (type === 'FAMILY') planType = 'FAMILY';
                if (classification === 'CORPORATE') planType = 'CORPORATE';

                const exists = await prisma.plan.findFirst({
                    where: { name: name }
                });

                if (exists) {
                    await prisma.plan.update({
                        where: { id: exists.id },
                        data: {
                            classification: classification as any,
                            plan_type: planType as any
                        }
                    });
                    console.log(`Updated: ${name}`);
                } else {
                    // Unique ID safety
                    const codeExists = await prisma.plan.findUnique({ where: { plan_id: code } });
                    const finalCode = codeExists ? `${code}-${Date.now().toString().slice(-4)}` : code;

                    await prisma.plan.create({
                        data: {
                            name,
                            plan_id: finalCode,
                            classification: classification as any,
                            plan_type: planType as any,
                            premium_amount: price,
                            annual_limit: limit,
                            description: `Standard ${classification} ${tier} ${type} Plan`,
                            status: 'ACTIVE',
                            created_by_id: user.id
                        }
                    });
                    console.log(`Created: ${name}`);
                }
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
