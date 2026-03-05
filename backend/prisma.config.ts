import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
    datasource: {
        url: 'file:./prisma/dev.db',
    },
});
