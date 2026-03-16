import { FirestoreService } from './FirestoreService';
import { GmailIntegration } from '../integrations/gmail';

export class EmailScheduler {
    static start() {
        console.log('--- Email Scheduler Initialization ---');
        
        // Initial check and then start interval
        this.processPendingEmails()
            .then(async () => {
                console.log('[Scheduler] Initial check completed. Starting interval...');
                setInterval(() => this.processPendingEmails(), 300000); // 5 minutes

                // Run pending task reminders every 24 hours
                const { ReminderService } = await import('./ReminderService');
                ReminderService.sendPendingTaskReminders();
                setInterval(() => ReminderService.sendPendingTaskReminders(), 24 * 60 * 60 * 1000);
            })
            .catch(async (err) => {
                console.error('[Scheduler] Initialization failed:', err.message);
                setInterval(() => this.processPendingEmails(), 300000);

                const { ReminderService } = await import('./ReminderService');
                setInterval(() => ReminderService.sendPendingTaskReminders(), 24 * 60 * 60 * 1000);
            });
    }

    private static async processPendingEmails() {
        try {
            const emails = await FirestoreService.query('scheduledEmails', [
                { field: 'status', operator: '==', value: 'PENDING' }
            ]);

            const now = new Date();
            // Filter locally for scheduledAt <= now since firestore query might need specific timestamp format
            const pending = emails.filter((e: any) => {
                const scheduledAt = e.scheduledAt?.toDate ? e.scheduledAt.toDate() : new Date(e.scheduledAt);
                return scheduledAt <= now;
            });

            if (pending.length === 0) return;

            console.log(`[Scheduler] Processing ${pending.length} pending emails...`);

            for (const email of pending) {
                try {
                    for (const to of email.toEmails) {
                        await GmailIntegration.sendEmail(email.fromEmail, to, email.subject, email.body);
                    }
                    
                    await FirestoreService.updateDoc('scheduledEmails', email.id, { status: 'SENT' });
                    console.log(`[Scheduler] Successfully sent email ID: ${email.id}`);
                } catch (err: any) {
                    console.error(`[Scheduler] Failed to send email ID: ${email.id}`, err);
                    await FirestoreService.updateDoc('scheduledEmails', email.id, { 
                        status: 'FAILED',
                        error: err.message || 'Unknown error'
                    });
                }
            }
        } catch (error: any) {
            console.error('[Scheduler Critical Error]', error);
        }
    }
}
