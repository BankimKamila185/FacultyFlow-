import { prisma } from './src/models/prisma';
import { AnalyticsService } from './src/services/AnalyticsService';

async function testQuery() {
    try {
        console.log('Simulating query for user: meetd@itm.edu');
        // Find user first to get ID
        const user = await prisma.user.findUnique({ where: { email: 'meetd@itm.edu' } });
        if (!user) {
            console.error('User not found');
            return;
        }

        console.log('User ID found:', user.id);
        const filter = { userId: user.id, email: user.email };
        
        console.log('Calling AnalyticsService.getDashboardMetrics...');
        const metrics = await AnalyticsService.getDashboardMetrics(filter);
        console.log('Metrics result:', JSON.stringify(metrics, null, 2));
    } catch (error) {
        console.error('CRASH in query:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testQuery();
