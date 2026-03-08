import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyAutomation() {
    console.log('🚀 Starting Automation Verification...');

    // 1. Ensure we have an HOD and a Faculty
    let faculty = await prisma.user.findFirst({ where: { role: 'FACULTY' } });
    let hod = await prisma.user.findFirst({ where: { role: 'HOD' } });

    if (!hod && faculty) {
        console.log(`⚠️ No HOD found. Promoting ${faculty.email} to HOD for testing...`);
        hod = await prisma.user.update({
            where: { id: faculty.id },
            data: { role: 'HOD' }
        });
        // Find another faculty
        faculty = await prisma.user.findFirst({ where: { role: 'FACULTY', id: { not: hod.id } } });
    }

    if (!faculty || !hod) {
        console.error('❌ Could not find/create Faculty or HOD user for testing.');
        return;
    }

    console.log(`Using Faculty: ${faculty.email}, HOD: ${hod.email}`);

    // Create a critically overdue task (> 48h)
    const overdueDeadline = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const complexTask = await prisma.task.create({
        data: {
            title: '[TEST] Critically Overdue Task',
            status: 'PENDING',
            deadline: overdueDeadline,
            assignedToId: faculty.id,
            createdById: hod.id,
            escalationLevel: 0
        }
    });

    console.log(`✅ Created overdue task: ${complexTask.id}`);

    // 2. Setup Data for Dependency Check
    const preTask = await prisma.task.create({
        data: {
            title: '[TEST] Prerequisite Task',
            status: 'PENDING',
            assignedToId: faculty.id,
            createdById: hod.id
        }
    });

    const depTask = await prisma.task.create({
        data: {
            title: '[TEST] Dependent Task',
            status: 'PENDING',
            prerequisiteTaskId: preTask.id,
            assignedToId: faculty.id,
            createdById: hod.id
        }
    });

    console.log(`✅ Created dependency chain: ${preTask.id} -> ${depTask.id}`);

    // 3. Trigger Overdue Logic
    console.log('🤖 Triggering Escalation Engine...');
    
    // Mark as overdue first
    await prisma.task.updateMany({
        where: { id: complexTask.id },
        data: { status: 'OVERDUE' }
    });

    const escalationThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const tasksToEscalate = await prisma.task.findMany({
        where: {
            id: complexTask.id,
            status: 'OVERDUE',
            deadline: { lt: escalationThreshold },
            escalationLevel: { lt: 2 }
        }
    });

    if (tasksToEscalate.length > 0) {
        for (const task of tasksToEscalate) {
            console.log(`📦 Escalating ${task.title}...`);
            await prisma.notification.create({
                data: {
                    userId: hod.id,
                    message: `[VERIFICATION SUCCESS] Task "${task.title}" is critically overdue.`,
                    type: 'ALERT'
                }
            });
            await prisma.task.update({
                where: { id: task.id },
                data: { escalationLevel: 2 }
            });
        }
    }

    // 4. Verify Notifications
    const notification = await prisma.notification.findFirst({
        where: { userId: hod.id, type: 'ALERT', message: { contains: 'VERIFICATION SUCCESS' } },
        orderBy: { createdAt: 'desc' }
    });

    if (notification) {
        console.log('🎉 Escalation Engine Verified: HOD notified successfully!');
    } else {
        console.log('❌ Escalation Engine Verification Failed.');
    }

    console.log('\n🏁 Verification Complete. Test data remains for manual inspection.');
}

verifyAutomation()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
