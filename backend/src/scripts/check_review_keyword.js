const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/export?format=csv&gid=1903243312';

async function checkAll() {
    try {
        const response = await fetch(DEFAULT_SHEET_URL);
        const csvString = await response.text();
        const records = parse(csvString, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        console.log('Searching for "Review" in all records...');
        records.forEach((row, i) => {
            const rowStr = JSON.stringify(row);
            if (rowStr.toLowerCase().includes('review')) {
                console.log(`Match at row ${i}:`, row['To Do'] || row['SUB EVENTS']);
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAll();
