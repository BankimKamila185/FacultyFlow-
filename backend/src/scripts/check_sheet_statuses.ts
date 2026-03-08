import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/export?format=csv&gid=1903243312';

async function checkStatuses() {
    try {
        console.log('Fetching sheet...');
        const response = await fetch(DEFAULT_SHEET_URL);
        const csvString = await response.text();
        const records = parse(csvString, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        const statusMap = new Map();
        records.forEach((row: any) => {
            const s = row['Status'] || '(Empty)';
            statusMap.set(s, (statusMap.get(s) || 0) + 1);
        });

        console.log('Unique Statuses found in Sheet (Count):');
        console.log(Object.fromEntries(statusMap));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkStatuses();
