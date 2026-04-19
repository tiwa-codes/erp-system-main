const { PrismaClient } = require('@prisma/client');

async function testValidateCoverage() {
  const prisma = new PrismaClient();
  try {
    const enrollee_id = 'cmj78ppdl0025iumy0lkphke6';
    const provider_id = 'cmj8xm1d300a0iujlr2vn5rtb';
    
    // Pick any service from the provider's tariff to test
    const randomService = await prisma.tariffPlanService.findFirst({
        where: { provider_id }
    });
    const service_ids = [randomService.service_id]; // test with one
    console.log(`Testing service ID: ${service_ids[0]}, Name: ${randomService.service_name}`);

    // ----- COPY-PASTE FROM validate-coverage route.ts ----- //
    const enrollee = await prisma.principalAccount.findUnique({
      where: { id: enrollee_id },
      include: {
        plan: true,
      }
    });

    const isBandMatch = true; // Assuming this passed in the logs earlier
    const providerServices = await prisma.tariffPlanService.findMany({
      where: {
        provider_id,
        service_id: { in: service_ids }
      }
    });

    const categoryMapping = new Map(); // Simplified
    const serviceTypes = await prisma.serviceType.findMany({
      where: { OR: [ { service_id: { in: service_ids } }, { id: { in: service_ids } } ] }
    });

    const serviceTypeMap = new Map();
    for (const st of serviceTypes) {
      serviceTypeMap.set(st.service_id, st);
      serviceTypeMap.set(st.id, st);
    }

    const allServiceTypes = await prisma.serviceType.findMany();
    // Simplified exactNameMap - let's skip for now and just check standard mapping

    for (const service of providerServices) {
      console.log(`\nEvaluating service: ${service.service_name}`);
      let serviceType = serviceTypeMap.get(service.service_id);
      
      console.log(`service_type_id found? ${!!serviceType}`);
      
      let coveredService = null;
      if (serviceType) {
        coveredService = await prisma.coveredService.findFirst({
          where: {
            plan_id: enrollee.plan.id,
            service_type_id: serviceType.id,
            status: 'ACTIVE'
          }
        });
        console.log(`coveredService matched exactly? ${!!coveredService}`);
      }

      const categoryCovered = await prisma.coveredService.findFirst({
        where: {
            plan_id: enrollee.plan.id,
            status: 'ACTIVE',
            service_type: {
                service_category: {
                    contains: service.category_name || (serviceType ? serviceType.service_category : ""),
                    mode: 'insensitive'
                }
            }
        }
      });
      console.log(`categoryCovered matched roughly? ${!!categoryCovered}`);
      
      if (!coveredService && !categoryCovered) {
          console.log(`RESULT: NOT COVERED`);
      } else {
          console.log(`RESULT: COVERED`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testValidateCoverage();
