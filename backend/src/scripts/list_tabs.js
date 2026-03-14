const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function listTabs() {
    const spreadsheetId = '1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0';
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '..', 'service-account.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        console.log('Tabs in spreadsheet:');
        response.data.sheets.forEach(sheet => {
            console.log(`- ${sheet.properties.title} (GID: ${sheet.properties.sheetId})`);
        });
    } catch (err) {
        console.error('The API returned an error: ' + err);
    }
}

listTabs();
