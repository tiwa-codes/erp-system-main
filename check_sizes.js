const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coveredCount = await prisma.coveredService.count();
  const packageCount = await prisma.packageLimit.count();
  const claimsCount = await prisma.claim.count();
  
  console.log(`Total CoveredServices: ${coveredCount}`);
  console.log(`Total PackageLimits: ${packageCount}`);
  console.log(`Total Claims: ${claimsCount}`);
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
