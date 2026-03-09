import { prisma } from '../models/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true
    }
  });
  console.log('Current Users in Database:');
  console.dir(users, { depth: null });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
