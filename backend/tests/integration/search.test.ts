import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/models/prisma';

describe('Search API Integration Tests', () => {
    let devToken: string;

    beforeAll(async () => {
        const loginRes = await request(app)
            .post('/api/auth/dev-login')
            .send({ email: 'searchtest@itm.edu' })
            .expect(200);

        devToken = loginRes.body.data.token;
    });

    it('GET /api/search should return results', async () => {
        // Create matching data
        await prisma.task.create({
            data: {
                title: 'Searchable Task',
                description: 'Searchable Description',
                deadline: new Date(),
                category: 'Testing',
                sprint: 'Sprint 1',
                priority: 'High',
            }
        });

        const res = await request(app)
            .get('/api/search?q=Searchable')
            .set('Authorization', `Bearer ${devToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.tasks).toBeDefined();
        expect(Array.isArray(res.body.data.tasks)).toBe(true);
    });
});
