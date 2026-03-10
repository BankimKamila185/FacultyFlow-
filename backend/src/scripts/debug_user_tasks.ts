import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
    const email = 'meetd@itm.edu';
    console.log(`Checking data for: ${email}`);
    
    const user = await prisma.user.findUnique({
        where: { email }
    });
    
    if (!user) {
        console.log('User not found in DB!');
        return;
    }
    
    console.log('User found:', user);
    
    const assignedTasks = await prisma.task.findMany({
        where: { assignedToId: user.id }
    });
    console.log(`Directly assigned tasks count: ${assignedTasks.length}`);
    
    const responsibleTasks = await prisma.task.findMany({
        where: {
            responsibles: {
                some: { email: email.toLowerCase() }
            }
        }
    });
    console.log(`Tasks where user is responsible (by email): ${responsibleTasks.length}`);
    
    // Check if there are any tasks at all
    const totalTasks = await prisma.task.count();
    console.log(`Total tasks in system: ${totalTasks}`);
    
    // Sample a few tasks
    const samples = await prisma.task.findMany({
        take: 5,
        include: { assignedTo: true }
    });
    console.log('Sample tasks with assignments:', JSON.stringify(samples, null, 2));

    await prisma.$disconnect();
}

debug();
