import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/export?format=csv&gid=1903243312';

async function checkHeaders() {
    try {
        const response = await fetch(DEFAULT_SHEET_URL);
        const csvString = await response.text();
        const records = parse(csvString, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (records.length > 0) {
            console.log('Headers found:');
            console.log(Object.keys(records[0] as any));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkHeaders();
