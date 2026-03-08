import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch'; // assuming it's available or using global fetch in node 18+

const prisma = new PrismaClient();
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/export?format=csv&gid=1903243312';

async function performSync() {
    try {
        console.log('Fetching CSV...');
        const res = await fetch(DEFAULT_SHEET_URL);
        const csvString = await res.text();
        const records = parse(csvString, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        console.log(`Parsed ${records.length} records.`);

        let count = 0;
        for (const row of records.slice(0, 10)) { // Just test first 10 for performance
            const rowData = row as any;
            const title = rowData['To Do'];
            if (!title) continue;

            console.log(`Processing: ${title}`);
            // ... truncated logic similar to controller ...
            count++;
        }
        console.log(`Sample sync complete for ${count} items.`);
    } catch (e) {
        console.error('Sync test error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

performSync();
