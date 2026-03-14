const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function listCollections() {
    const serviceAccountPath = path.join(__dirname, '../../service-account.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('Service account file not found at:', serviceAccountPath);
        return;
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    const db = admin.firestore();
    try {
        const collections = await db.listCollections();
        console.log('Collections:', collections.map(c => c.id));
        
        for (const collection of collections) {
            const snapshot = await collection.limit(5).get();
            console.log(`\n--- Collection: ${collection.id} (first 5 docs) ---`);
            const docs = [];
            snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
            console.log(JSON.stringify(docs, null, 2));
        }
    } catch (error) {
        console.error('Error listing collections:', error);
    }
}

listCollections();
