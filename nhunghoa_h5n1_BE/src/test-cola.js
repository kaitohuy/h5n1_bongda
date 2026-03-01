const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('request', req => {
        if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
            console.log(`[REQ] ${req.url()}`);
        }
    });

    page.on('response', async res => {
        if (res.request().resourceType() === 'fetch' || res.request().resourceType() === 'xhr') {
            const url = res.url();
            if (url.includes('api') || url.includes('json') || url.includes('match')) {
                try {
                    const text = await res.text();
                    console.log(`[RES] ${url.substring(0, 100)}... -> SIZE: ${text.length} start: ${text.substring(0, 100)}`);
                } catch (e) {
                    console.log(`[ERR] ${url} - ${e.message}`);
                }
            }
        }
    });

    console.log("Navigating to colatv.live...");
    await page.goto('https://colatv.live', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    console.log("Done");
    await browser.close();
})();
