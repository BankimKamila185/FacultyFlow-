import { FirestoreService } from '../src/services/FirestoreService';

async function checkScheduledEmails() {
    try {
        const emails = await FirestoreService.getCollection('scheduledEmails');
        const pending = emails.filter((e: any) => e.status === 'PENDING');
        console.log(`Total Pending Scheduled Emails: ${pending.length}`);
        pending.forEach((e: any) => {
            console.log(`- Subject: ${e.subject}, ScheduledAt: ${e.scheduledAt?.toDate ? e.scheduledAt.toDate() : e.scheduledAt}`);
        });
    } catch (e) {
        console.error(e);
    }
}

checkScheduledEmails();
