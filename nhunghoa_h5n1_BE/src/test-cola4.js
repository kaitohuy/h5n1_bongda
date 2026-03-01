const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async res => {
        const url = res.url();
        if (res.request().resourceType() === 'fetch' || res.request().resourceType() === 'xhr') {
            console.log(`[XHR] ${url}`);
        }
    });

    console.log("Navigating to https://colatv42.live...");
    await page.goto('https://colatv42.live', { waitUntil: 'networkidle', timeout: 15000 });

    // wait a bit more for background API calls
    await page.waitForTimeout(5000);

    console.log("Done");
    await browser.close();
})();
