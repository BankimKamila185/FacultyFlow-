import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';

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

        console.log('Testing getFirestore with dbId...');
        try {
            // According to firebase v12+ signature: getFirestore(app?: App, databaseId?: string)
            // But we can check it:
            const dbNamed = getFirestore(app, process.env.FIREBASE_DATABASE_ID || 'facultyflow');
            const docs2 = await dbNamed.collection('departments').limit(1).get();
            console.log('facultyflow DB success via getFirestore. Docs:', docs2.size);
            
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
