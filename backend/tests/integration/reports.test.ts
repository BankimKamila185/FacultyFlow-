import request from 'supertest';
import app from '../../src/app';

describe('Reports API Integration Tests', () => {
    let devToken: string;

    beforeAll(async () => {
        const loginRes = await request(app)
            .post('/api/auth/dev-login')
            .send({ email: 'reporttest@itm.edu' })
            .expect(200);

        devToken = loginRes.body.data.token;
    });

    it('GET /api/reports/pdf should return a PDF file', async () => {
        const res = await request(app)
            .get('/api/reports/pdf')
            .set('Authorization', `Bearer ${devToken}`)
            .expect(200);

        expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('GET /api/reports/excel should return an Excel file', async () => {
        const res = await request(app)
            .get('/api/reports/excel')
            .set('Authorization', `Bearer ${devToken}`)
            .expect(200);

        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
});
