const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { sheetUrl: { not: null } },
        select: { email: true, sheetUrl: true }
    });
    console.log('Users with sheetUrl:');
    console.log(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
