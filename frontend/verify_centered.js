import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  
  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
    
    const screenshotPath = '/Users/bankimkamila/.gemini/antigravity/brain/4bb4e713-8b1b-4f67-845a-d7a5abeceb08/centered_verification.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
