import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'meetd@itm.edu';
  const myResponsibles = await prisma.taskResponsible.findMany({
    where: { email: email.toLowerCase() },
    include: {
      task: {
        include: {
          workflow: true,
          responsibles: true,
        }
      }
    }
  });

  console.log(`Total responsibles for ${email}: ${myResponsibles.length}`);
  myResponsibles.forEach((tr, i) => {
    console.log(`Task ${i+1}: ${tr.task.title} | Status: ${tr.task.status} | Role: ${tr.role}`);
  });

  const inProgress = myResponsibles.filter(tr => tr.task.status === 'IN_PROGRESS');
  const pending = myResponsibles.filter(tr => tr.task.status === 'PENDING');
  console.log(`In Progress Tasks (Upcoming): ${inProgress.length}`);
  console.log(`Pending Tasks: ${pending.length}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
