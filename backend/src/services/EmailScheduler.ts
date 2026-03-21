import { FirestoreService } from './FirestoreService';
import { sendRaw } from './MailService';

export class EmailScheduler {
    private static lastMorningTrigger: string | null = null;
    private static lastAfternoonTrigger: string | null = null;
    private static lastEveningTrigger: string | null = null;

    static start() {
        console.log('--- Email Scheduler Initialization ---');
        
        // Initial check for scheduled emails
        this.processPendingEmails()
            .then(() => {
                console.log('[Scheduler] Initial check completed. Starting interval...');
                // Run every minute for precise time triggers
                setInterval(() => this.tick(), 60000);
            })
            .catch((err) => {
                console.error('[Scheduler] Initialization failed:', err.message);
                setInterval(() => this.tick(), 60000);
            });
    }

    private static async tick() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const dateStr = now.toISOString().split('T')[0];

        // 1. Process ad-hoc scheduled emails (every tick is fine)
        await this.processPendingEmails();

        // 2. 10:00 AM - Morning Reminders + Deadline Check
        if (hour === 10 && minute === 0 && this.lastMorningTrigger !== dateStr) {
            this.lastMorningTrigger = dateStr;
            const { ReminderService } = await import('./ReminderService');
            console.log('[Scheduler] Triggering Morning Reminders (10 AM)');
            ReminderService.sendMorningReminders().catch(console.error);
        }

        // 3. 02:00 PM - Afternoon Follow-up
        if (hour === 14 && minute === 0 && this.lastAfternoonTrigger !== dateStr) {
            this.lastAfternoonTrigger = dateStr;
            const { ReminderService } = await import('./ReminderService');
            console.log('[Scheduler] Triggering Afternoon Reminders (2 PM)');
            ReminderService.sendAfternoonReminders().catch(console.error);
        }

        // 4. 06:00 PM - End of Day Report
        if (hour === 18 && minute === 0 && this.lastEveningTrigger !== dateStr) {
            this.lastEveningTrigger = dateStr;
            const { ReminderService } = await import('./ReminderService');
            console.log('[Scheduler] Triggering End of Day Report (6 PM)');
            ReminderService.sendEndOfDayReport().catch(console.error);
        }
    }

    private static async processPendingEmails() {
        try {
            const emails = await FirestoreService.query('scheduledEmails', [
                { field: 'status', operator: '==', value: 'PENDING' }
            ]);

            const now = new Date();
            const pending = emails.filter((e: any) => {
                const scheduledAt = e.scheduledAt?.toDate ? e.scheduledAt.toDate() : new Date(e.scheduledAt);
                return scheduledAt <= now;
            });

            if (pending.length === 0) return;

            console.log(`[Scheduler] Processing ${pending.length} pending emails...`);

            for (const email of pending) {
                try {
                    for (const to of email.toEmails) {
                        await sendRaw(to, email.subject, email.body, email.fromEmail);
                    }
                    await FirestoreService.updateDoc('scheduledEmails', email.id, { status: 'SENT' });
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
