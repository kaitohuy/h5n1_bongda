const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log("Navigating...");
    await page.goto('https://colatv42.live', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'colatv_test.png', fullPage: true });

    console.log("Saved colatv_test.png");
    await browser.close();
})();
