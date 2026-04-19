const { PrismaClient } = require('@prisma/client');

async function test() {
  console.log("Starting DB Ping Test...");
  const startClient = Date.now();
  const prisma = new PrismaClient();
  console.log(`PrismaClient Instance created in ${Date.now() - startClient}ms`);

  const startConnect = Date.now();
  try {
    await prisma.$connect();
    console.log(`Prisma $connect took ${Date.now() - startConnect}ms`);

    const startQuery = Date.now();
    const count = await prisma.principalAccount.count();
    console.log(`Simple count query took ${Date.now() - startQuery}ms (Count: ${count})`);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
