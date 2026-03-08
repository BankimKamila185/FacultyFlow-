import { prisma } from './models/prisma';

async function checkTokens() {
  const tokens = await prisma.deviceToken.findMany({
    include: { user: true }
  });
  console.log('--- Registered FCM Tokens ---');
  if (tokens.length === 0) {
    console.log('No tokens found.');
  } else {
    tokens.forEach(t => {
      console.log(`User: ${t.user.email} | Token: ${t.token.substring(0, 20)}...`);
    });
  }
}

checkTokens().catch(console.error);
