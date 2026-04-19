const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plan_id = 'cmhb5x1p1002giu92atw7pge1'; 
  console.log("Plan ID:", plan_id);

  console.log("1. Fetching Plan...");
  const plan = await prisma.plan.findUnique({
    where: { id: plan_id },
    select: { id: true, name: true }
  });
  console.log("Plan found:", !!plan);

  console.log("2. Fetching CoveredServices...");
  const start = Date.now();
  const coveredServices = await prisma.coveredService.findMany({
    where: { plan_id: plan_id, status: "ACTIVE" },
    include: {
      service_type: true
    },
    orderBy: { service_type: { service_category: "asc" } }
  });
  console.log(`CoveredServices found: ${coveredServices.length} (took ${Date.now() - start}ms)`);

  console.log("3. Fetching PackageLimits...");
  const packageLimits = await prisma.packageLimit.findMany({
    where: { plan_id: plan_id, status: "ACTIVE" },
    orderBy: { category: "asc" }
  });
  console.log(`PackageLimits found: ${packageLimits.length}`);
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
