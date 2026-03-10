import { prisma } from '../models/prisma';

async function test() {
    // Simulate meetd@itm.edu
    const userEmail = 'meetd@itm.edu';
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    
    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('Simulating for user:', user);
    
    const isFaculty = user?.role?.toUpperCase() === 'FACULTY';
    const whereClause = isFaculty ? {
        OR: [
            { assignedToId: user.id },
            { responsibles: { some: { email: user.email?.toLowerCase() } } }
        ]
    } : {};
    
    console.log('Where clause:', JSON.stringify(whereClause, null, 2));

    const tasks = await prisma.task.findMany({
        where: whereClause,
        include: {
            workflow: true,
            assignedTo: { select: { email: true, name: true } },
            responsibles: true,
        },
        orderBy: { startDate: 'asc' }
    });

    console.log('Tasks found:', tasks.length);
    if (tasks.length > 0) {
        console.log('First task title:', tasks[0].title);
    }
}

test().then(() => prisma.$disconnect());
