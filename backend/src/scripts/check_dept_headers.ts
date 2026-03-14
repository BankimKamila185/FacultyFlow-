import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

const DEPT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/export?format=csv&gid=21350203';

async function checkDeptHeaders() {
    try {
        console.log('Fetching Department sheet...');
        const response = await fetch(DEPT_SHEET_URL);
        const csvString = await response.text();
        const records = parse(csvString, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (records.length > 0) {
            console.log('Department Sheet Headers found:');
            console.log(Object.keys(records[0] as any));
            console.log('Sample Record:', JSON.stringify(records[0], null, 2));
        } else {
            console.log('No records found in Department sheet.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkDeptHeaders();
