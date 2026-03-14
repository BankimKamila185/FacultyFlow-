import * as admin from 'firebase-admin';
import path from 'path';

async function diagnoseAuth() {
    try {
        const serviceAccount = path.join(__dirname, 'service-account.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        
        console.log('Firebase Auth initialized. Listing first 10 users...');
        const users = await admin.auth().listUsers(10);
        console.log('✅ Auth successful! Users found:', users.users.length);
        users.users.forEach(u => console.log(' - User:', u.email));
        
        process.exit(0);
    } catch (error: any) {
        console.error('❌ MAPPING ERROR:', error);
        console.error('Error Code:', error.code);
        process.exit(1);
    }
}

diagnoseAuth();
