const { PrismaClient } = require('@prisma/client');

async function testCoverage() {
  const prisma = new PrismaClient();
  try {
    const enrollee_id = 'cmj78ppdl0025iumy0lkphke6';
    const provider_id = 'cmj8xm1d300a0iujlr2vn5rtb';
    
    // 1. Get enrollee plan
    const enrollee = await prisma.principalAccount.findUnique({
      where: { id: enrollee_id },
      include: {
        plan: true,
      }
    });
    
    if (!enrollee) {
      console.log('Enrollee not found!');
      return;
    }
    
    console.log(`Enrollee Plan: ${enrollee.plan.name} (ID: ${enrollee.plan.id})`);

    // 2. Let's find ANY covered service for this plan
    const coveredServicesCount = await prisma.coveredService.count({
      where: { plan_id: enrollee.plan.id, status: 'ACTIVE' }
    });
    
    console.log(`Total active covered services for plan: ${coveredServicesCount}`);
    
    if (coveredServicesCount === 0) {
      console.log('NO COVERED SERVICES MAPPED TO PLAN! THIS IS WHY EVERYTHING FAILS.');
    } else {
      // Just list a few to see what they look like
      const sample = await prisma.coveredService.findMany({
        where: { plan_id: enrollee.plan.id, status: 'ACTIVE' },
        take: 3,
        include: { service_type: true }
      });
      console.log('Sample covered services:', JSON.stringify(sample, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCoverage();
