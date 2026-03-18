import { LocalDataService } from './src/services/LocalDataService';

async function test() {
    try {
        console.log('Starting Accuracy Test...');
        await LocalDataService.initialize();

        const users = await LocalDataService.getCollection('users');
        console.log(`Loaded ${users.length} users.`);

        const departments = await LocalDataService.getCollection('departments');
        console.log(`Loaded ${departments.length} departments.`);

        // Verify specific users
        const testEmails = [
            'meetd@itm.edu', 
            'kalpanas@itm.edu', 
            'Aartip@itm.edu', 
            'jasminet@itm.edu', 
            'Techfaculty@itm.edu',
            'harshitad@itm.edu'
        ];
        
        console.log('\n--- User Accuracy Check ---');
        for (const email of testEmails) {
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (user) {
                console.log(`User: ${user.email}`);
                console.log(`  Role: ${user.role}`);
                console.log(`  Dept: ${user.department}`);
            } else {
                console.log(`User ${email} not found in registry.`);
            }
        }

        const tasks = await LocalDataService.getCollection('tasks');
        console.log(`\nTotal Tasks: ${tasks.length}`);
        
        // Check for role consistency
        const roles = new Set(users.map(u => u.role));
        console.log('\nRoles found:', Array.from(roles));

    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
