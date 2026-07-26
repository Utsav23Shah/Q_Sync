import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  console.log('Navigating to Vercel...');
  await page.goto('https://frontend-lovat-seven-87.vercel.app/dashboard', { waitUntil: 'networkidle0' });
  console.log('Page loaded.');
  
  await browser.close();
})();
