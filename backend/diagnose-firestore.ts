import * as admin from 'firebase-admin';
import path from 'path';

async function diagnose() {
    try {
        const serviceAccount = path.join(__dirname, 'service-account.json');
        console.log('Using service account:', serviceAccount);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        
        const db = admin.firestore();
        console.log('Firestore initialized. Attempting to write a test document to "healthcheck/test"...');
        
        const docRef = db.collection('healthcheck').doc('test');
        await docRef.set({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: 'Diagnostic test'
        });
        
        console.log('✅ Write successful!');
        const doc = await docRef.get();
        console.log('✅ Read successful! Data:', doc.data());
        
        await docRef.delete();
        console.log('✅ Cleanup successful!');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ MAPPING ERROR:', error);
        console.error('Error Code:', error.code);
        console.error('Error Details:', error.details);
        console.error('Stack Trace:', error.stack);
        process.exit(1);
    }
}

diagnose();
