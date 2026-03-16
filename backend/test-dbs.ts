import * as admin from 'firebase-admin';
import path from 'path';

async function test() {
    const serviceAccount = path.join(__dirname, 'service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('Testing (default) DB...');
    try {
        const dbDefault = admin.firestore();
        const docs = await dbDefault.collection('departments').limit(1).get();
        console.log('Default DB success. Docs:', docs.size);
    } catch (e: any) {
        console.log('Default DB error:', e.message);
    }
    
    console.log('\nTesting facultyflow DB...');
    try {
        // To use named database in firebase-admin
        const dbNamed = admin.firestore(admin.app());
        if (typeof dbNamed.settings === 'function') {
            // Wait, firestore() doesn't take databaseId in admin.firestore() currently?
            // Wait, in latest firebase-admin (12+): db = admin.firestore()
            // db.settings({ databaseId: 'facultyflow' }) ? No.
            // Correct way:
            const { Firestore } = require('@google-cloud/firestore');
            const projectId = require('./service-account.json').project_id;
            const db = new Firestore({
                projectId,
                keyFilename: serviceAccount,
                databaseId: 'facultyflow'
            });
            const docs2 = await db.collection('departments').limit(1).get();
            console.log('facultyflow DB success. Docs:', docs2.size);
        }
    } catch (e: any) {
        console.log('facultyflow DB error:', e.message);
    }
    process.exit(0);
}
test();
