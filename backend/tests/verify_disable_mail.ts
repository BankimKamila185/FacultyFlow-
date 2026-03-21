import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from the root of backend
dotenv.config({ path: path.join(__dirname, '../.env') });

import { sendRaw } from '../src/services/MailService';

async function test() {
    console.log('DISABLE_EMAILS:', process.env.DISABLE_EMAILS);
    
    console.log('\n--- Testing sendRaw ---');
    const result = await sendRaw('test@example.com', 'Test Subject', '<p>Test Body</p>');
    
    if (result && process.env.DISABLE_EMAILS === 'true') {
        console.log('✅ Success: Email was skipped as expected.');
    } else if (!result && process.env.DISABLE_EMAILS !== 'true') {
        console.log('❌ Failure: Email sending failed but should have been attempted (or credentials missing).');
    } else {
        console.log('❓ Unexpected result:', { result, DISABLE_EMAILS: process.env.DISABLE_EMAILS });
    }
}

test().catch(console.error);
