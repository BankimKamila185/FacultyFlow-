import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
    try {
        const fbConfig = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };
        
        const app = admin.initializeApp({
            credential: admin.credential.cert(fbConfig as any)
        });

        console.log('Testing (default) DB on', fbConfig.projectId);
        try {
            const dbDefault = admin.firestore(app);
            const docs = await dbDefault.collection('departments').limit(1).get();
            console.log('Default DB success. Docs:', docs.size);
        } catch (e: any) {
            console.log('Default DB error:', e.message);
        }

        console.log('\nTesting facultyflow DB on', fbConfig.projectId);
        try {
            const { Firestore } = require('@google-cloud/firestore');
            const dbNamed = new Firestore({
                projectId: fbConfig.projectId,
                credentials: {
                    client_email: fbConfig.clientEmail,
                    private_key: fbConfig.privateKey
                },
                databaseId: 'facultyflow'
            });
            const docs2 = await dbNamed.collection('departments').limit(1).get();
            console.log('facultyflow DB success. Docs:', docs2.size);
            
            // test writing
            await dbNamed.collection('test_connection').doc('ping').set({ ts: new Date() });
            console.log('facultyflow DB write success!');
        } catch (e: any) {
            console.log('facultyflow DB error:', e.message);
        }
        process.exit(0);
    } catch (err) {
        console.error("Initialization error:", err);
        process.exit(1);
    }
}
test();
