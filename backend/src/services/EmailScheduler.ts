import { prisma } from '../models/prisma';
import { GmailIntegration } from '../integrations/gmail';

export class EmailScheduler {
    static start() {
        console.log('--- Email Scheduler Started ---');
        // Check every minute
        setInterval(() => this.processPendingEmails(), 60000);
    }

    private static async processPendingEmails() {
        try {
            const now = new Date();
            const pending = await prisma.scheduledEmail.findMany({
                where: {
                    status: 'PENDING',
                    scheduledAt: { lte: now }
                }
            });

            if (pending.length === 0) return;

            console.log(`[Scheduler] Processing ${pending.length} pending emails...`);

            for (const email of pending) {
                try {
                    for (const to of email.toEmails) {
                        await GmailIntegration.sendEmail(email.fromEmail, to, email.subject, email.body);
                    }
                    
                    await prisma.scheduledEmail.update({
                        where: { id: email.id },
                        data: { status: 'SENT' }
                    });
                    console.log(`[Scheduler] Successfully sent email ID: ${email.id}`);
                } catch (err: any) {
                    console.error(`[Scheduler] Failed to send email ID: ${email.id}`, err);
                    await prisma.scheduledEmail.update({
                        where: { id: email.id },
                        data: { 
                            status: 'FAILED',
                            error: err.message || 'Unknown error'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[Scheduler Critical Error]', error);
        }
    }
}
