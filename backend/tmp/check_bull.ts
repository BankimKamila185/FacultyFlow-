import { workflowQueue } from '../src/jobs/worker';

async function checkRepeatableJobs() {
    try {
        const jobs = await workflowQueue.getRepeatableJobs();
        console.log('--- Repeatable Jobs ---');
        jobs.forEach(j => {
            console.log(`Key: ${j.key}`);
            console.log(`Name: ${j.name}`);
            console.log(`Next run: ${new Date(j.next).toLocaleString()}`);
            console.log(`Pattern: ${j.cron}`);
            console.log('-------------------');
        });
        
        const pendingJobs = await workflowQueue.getJobs(['waiting', 'active', 'delayed']);
        console.log(`\nPending Jobs Count: ${pendingJobs.length}`);
        
        const completedJobs = await workflowQueue.getJobs(['completed', 'failed'], 0, 10, true);
        console.log(`\nRecently Finished Jobs:`);
        completedJobs.forEach(j => {
            console.log(`[${j.finishedOn ? new Date(j.finishedOn).toLocaleTimeString() : 'N/A'}] Job ${j.id} (${j.name}) Status: ${await j.getState()}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkRepeatableJobs();
