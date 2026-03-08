import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users Count:', users.length);
    console.log('User Emails:', users.map(u => u.email));

    const tasks = await prisma.task.findMany();
    console.log('Total Tasks:', tasks.length);

    const meetd = await prisma.user.findUnique({ where: { email: 'meetd@itm.edu' } });
    if (meetd) {
        const meetdTasks = await prisma.task.findMany({
            where: {
                OR: [
                    { assignedToId: meetd.id },
                    { responsibles: { some: { email: 'meetd@itm.edu' } } }
                ]
            }
        });
        console.log('Tasks for meetd@itm.edu:', meetdTasks.length);
    } else {
        console.log('User meetd@itm.edu NOT found in DB');
    }

    const workflows = await prisma.workflow.findMany();
    console.log('Workflows:', workflows.length);
  } catch (err) {
    console.error('DB Check error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
