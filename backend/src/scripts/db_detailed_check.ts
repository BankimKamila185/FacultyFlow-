import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'meetd@itm.edu' } });
    console.log('User meetd@itm.edu:', user);

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { assignedToId: user?.id },
          { responsibles: { some: { email: 'meetd@itm.edu' } } }
        ]
      },
      include: {
        workflow: true,
        responsibles: true
      }
    });
    
    console.log(`Found ${tasks.length} tasks for meetd@itm.edu`);
    tasks.forEach(t => {
      console.log(`- [${t.status}] ${t.title} (Workflow: ${t.workflow?.type}, Sprint: ${t.workflow?.sprintName})`);
    });

    const allWorkflows = await prisma.workflow.findMany({
        include: { tasks: true }
    });
    console.log('\nWorkflows Status:');
    allWorkflows.forEach(wf => {
        console.log(`- ${wf.type}: ${wf.tasks.length} tasks, Status: ${wf.status}`);
    });

  } catch (err) {
    console.error('Check error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
