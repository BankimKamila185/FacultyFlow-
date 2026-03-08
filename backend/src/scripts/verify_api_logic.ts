import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  try {
    const workflows = await prisma.workflow.findMany({
        include: { tasks: true }
    });
    
    console.log('API Simulation (Progress Data):');
    workflows.forEach(wf => {
        const totalTasks = wf.tasks.length;
        const completedTasks = wf.tasks.filter((t: any) => t.status === 'COMPLETED').length;
        
        let calculatedStatus = wf.status;
        if (totalTasks > 0) {
            if (completedTasks === totalTasks) calculatedStatus = 'COMPLETED';
            else if (completedTasks > 0) calculatedStatus = 'IN_PROGRESS';
            else calculatedStatus = 'PENDING';
        } else {
            calculatedStatus = 'PENDING';
        }

        console.log(`- Title: ${wf.type}, Status: ${calculatedStatus}, Progress: ${totalTasks === 0 ? 0 : Math.round((completedTasks/totalTasks)*100)}%`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
