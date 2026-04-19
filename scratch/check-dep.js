const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const dep = await prisma.dependent.findUnique({
    where: { id: 'cmk425r61000qiun2fic2tpbs' },
    select: { id: true, first_name: true, profile_picture: true }
  });
  console.log('Result:', JSON.stringify(dep, null, 2));
  await prisma.$disconnect();
}

check();
