
import { firebaseAdmin } from './src/integrations/firebase';
const db = firebaseAdmin.firestore();

async function promoteToAdmin(email: string) {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email.toLowerCase()).get();
  
  if (snapshot.empty) {
    console.log('No user found with email:', email);
    await usersRef.add({
      email: email.toLowerCase(),
      name: email.split('@')[0],
      role: 'ADMIN',
      createdAt: new Date().toISOString()
    });
    console.log('Created new ADMIN user:', email);
  } else {
    const doc = snapshot.docs[0];
    await doc.ref.update({ role: 'ADMIN' });
    console.log('Promoted user to ADMIN:', email);
  }
}

promoteToAdmin('meetd@itm.edu')
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
