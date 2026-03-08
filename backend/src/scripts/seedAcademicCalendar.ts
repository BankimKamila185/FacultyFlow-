import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const filePath = '/Users/bankimkamila/Downloads/WorkFlow BTech Academic Calendar - Semester 2 (1).xlsx';
    console.log(`Reading Excel file from: ${filePath}`);

    let workbook;
    try {
        workbook = xlsx.readFile(filePath);
    } catch (error) {
        console.error('Failed to read Excel file:', error);
        process.exit(1);
    }

    const sheetName = workbook.SheetNames[0]; // Process the first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any>(worksheet);

    console.log(`Found ${data.length} rows in sheet '${sheetName}'.`);

    // Ensure Admin user exists for 'createdBy'
    const adminEmail = 'admin@facultyflow.com';
    let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
        adminUser = await prisma.user.create({
            data: {
                email: adminEmail,
                name: 'System Admin',
                role: 'ADMIN',
            },
        });
        console.log(`Created admin user: ${adminUser.email}`);
    }

    // Process rows
    let createdCount = 0;
    for (const row of data) {
        const taskTitle = row['To Do'] || row['Main Event'];
        if (!taskTitle) continue;

        const email = row['Responsible Person 1 Email Id'] || row['BU Head Person Email Id'] || 'unassigned@facultyflow.com';
        const deadlineRaw = row['End date (MM/DD/YYYY)'];

        // Parse deadline
        let deadline: Date | null = null;
        if (deadlineRaw) {
            if (typeof deadlineRaw === 'number') {
                // Excel date serial number
                deadline = new Date(Math.round((deadlineRaw - 25569) * 86400 * 1000));
            } else if (typeof deadlineRaw === 'string') {
                deadline = new Date(deadlineRaw);
            }
        }
        if (deadline && isNaN(deadline.getTime())) {
            deadline = null;
        }

        // Find or create assigned user
        let assignedUser = await prisma.user.findUnique({ where: { email: email.trim() } });
        if (!assignedUser) {
            assignedUser = await prisma.user.create({
                data: {
                    email: email.trim(),
                    name: email.split('@')[0], // Placeholder name
                    role: 'FACULTY',
                },
            });
            console.log(`Created auto-generated user: ${assignedUser.email}`);
        }

        const descriptionParts = [];
        if (row['Phase/Sprint']) descriptionParts.push(`Phase: ${row['Phase/Sprint']}`);
        if (row['Main Event']) descriptionParts.push(`Main Event: ${row['Main Event']}`);

        await prisma.task.create({
            data: {
                title: String(taskTitle).substring(0, 255), // ensure limits
                description: descriptionParts.join('\n') || null,
                deadline,
                assignedToId: assignedUser.id,
                createdById: adminUser.id,
                status: 'PENDING',
            },
        });
        createdCount++;
    }

    console.log(`Successfully imported ${createdCount} tasks from the Academic Calendar!`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
