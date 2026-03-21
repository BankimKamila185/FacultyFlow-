import { setupCronJobs, workflowQueue } from '../src/jobs/worker';

async function resetAndTrigger() {
    try {
        console.log('--- Resetting Cron Jobs ---');
        await setupCronJobs();
        console.log('Cron jobs re-scheduled.');

        console.log('Adding immediate CHECK_OVERDUE job...');
        await workflowQueue.add('manual-immediate-check', { action: 'CHECK_OVERDUE' });
        console.log('Job added to queue.');

        // Give it 10 seconds to process
        await new Promise(resolve => setTimeout(resolve, 10000));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

resetAndTrigger();
