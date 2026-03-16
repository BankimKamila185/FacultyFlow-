import * as admin from 'firebase-admin';
import path from 'path';

async function test() {
    try {
        const serviceAccount = path.join(__dirname, 'service-account.json');
        
        // Initialize admin without checking apps length to control it precisely here
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('Testing (default) DB...');
        try {
            const dbDefault = admin.firestore(app);
            const docs = await dbDefault.collection('departments').limit(1).get();
            console.log('Default DB success. Docs:', docs.size);
        } catch (e: any) {
            console.log('Default DB error:', e.message);
        }

        console.log('\nTesting facultyflow DB...');
        try {
            // How to use named database in firebase-admin?
            // In v12+, firebase-admin upgraded @google-cloud/firestore
            // admin.firestore() doesn't officially support databaseId in its type definitions sometimes, but we can do:
            const { Firestore } = require('@google-cloud/firestore');
            const projectId = require('./service-account.json').project_id;
            const dbNamed = new Firestore({
                projectId,
                keyFilename: serviceAccount,
                databaseId: 'facultyflow'
            });
            const docs2 = await dbNamed.collection('departments').limit(1).get();
            console.log('facultyflow DB success. Docs:', docs2.size);
            
            // Try to write a test doc
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
