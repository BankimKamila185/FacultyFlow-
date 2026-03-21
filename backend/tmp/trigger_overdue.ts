import { workflowQueue } from '../src/jobs/worker';

async function triggerNow() {
    try {
        console.log('Adding manual CHECK_OVERDUE job...');
        const job = await workflowQueue.add('manual-check', { action: 'CHECK_OVERDUE' });
        console.log(`Job added with ID: ${job.id}`);
        
        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const state = await job.getState();
        console.log(`Final Job State: ${state}`);
        
        if (state === 'failed') {
            const fullJob = await workflowQueue.getJob(job.id!);
            console.error('Job failure reason:', fullJob?.failedReason);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

triggerNow();
