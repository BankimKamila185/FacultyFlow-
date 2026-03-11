import { FirestoreService } from './services/FirestoreService';

async function checkTokens() {
  const tokens = await FirestoreService.getCollection('deviceTokens');
  console.log('--- Registered FCM Tokens ---');
  if (tokens.length === 0) {
    console.log('No tokens found.');
  } else {
    for (const t of tokens) {
      const user = await FirestoreService.getDoc<any>('users', t.userId);
      console.log(`User: ${user?.email || 'Unknown'} | Token: ${t.token.substring(0, 20)}...`);
    }
  }
}

checkTokens().catch(console.error);
