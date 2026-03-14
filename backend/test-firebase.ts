
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const config = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
};

console.log('Config loaded:');
console.log('Project ID:', config.FIREBASE_PROJECT_ID);
console.log('Client Email:', config.FIREBASE_CLIENT_EMAIL);
console.log('Private Key length:', config.FIREBASE_PRIVATE_KEY?.length);
console.log('Private Key starts with:', config.FIREBASE_PRIVATE_KEY?.substring(0, 20));

try {
    const serviceAccount = path.join(__dirname, 'service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully using service-account.json.');
    
    const db = admin.firestore();
    console.log('Attempting to list collections...');
    db.listCollections().then(collections => {
        console.log('Collections found:', collections.map(c => c.id));
        process.exit(0);
    }).catch(err => {
        console.error('Firestore Error:', err);
        process.exit(1);
    });
} catch (error) {
    console.error('Initialization Error:', error);
    process.exit(1);
}
