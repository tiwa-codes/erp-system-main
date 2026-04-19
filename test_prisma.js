const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const principal = await prisma.principalAccount.findFirst();
  console.log(principal);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
