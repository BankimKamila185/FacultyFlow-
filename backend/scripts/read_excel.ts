import * as xlsx from 'xlsx';
import path from 'path';

const filePath = '/Users/bankimkamila/Downloads/WorkFlow BTech Academic Calendar - Semester 2 (1).xlsx';

try {
    console.log(`Reading file: ${filePath}`);
    const workbook = xlsx.readFile(filePath);

    console.log('\n--- Workbook Sheets ---');
    console.log(workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        console.log(`\n--- Data in Sheet: ${sheetName} ---`);
        const sheet = workbook.Sheets[sheetName];
        // Convert to JSON (array of arrays to see raw structure)
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        // Print the first 15 rows to understand the structure
        console.log(data.slice(0, 15));
    }
} catch (error) {
    console.error('Failed to read Excel file:', error);
}
