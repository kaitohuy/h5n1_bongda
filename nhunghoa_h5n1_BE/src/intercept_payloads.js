const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

async function interceptPayloads() {
    console.log('Khởi chạy Playwright để bắt POST payloads...');
    const browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    await page.route('**/*', route => {
        if (route.request().url().includes('guard_v1.js') ||
            route.request().resourceType() === 'image' ||
            route.request().resourceType() === 'stylesheet' ||
            route.request().resourceType() === 'font') {
            return route.abort();
        }
        route.continue();
    });

    page.on('request', async (req) => {
        if (req.url().includes('matches/graph') && req.method() === 'POST') {
            console.log('\n--- BẮT ĐƯỢC POST REQUEST ---');
            console.log('URL:', req.url());
            console.log('Payload:', req.postData());
        }
    });

    console.log('Đang truy cập https://xem1.gv05.live/ ...');
    await page.goto('https://xem1.gv05.live/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('Goto timeout/error:', e.message));
    console.log('Chờ thêm 5s...');
    await page.waitForTimeout(5000);
    await browser.close();
}
interceptPayloads().catch(console.error);
