const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async res => {
        const url = res.url();
        if (url.includes('api') || url.includes('json') || url.includes('match') || url.includes('home')) {
            try {
                const text = await res.text();
                // Check if it looks like JSON array or object with matches
                if (text.includes('homeName') || text.includes('homeTeam') || text.includes('match') || text.includes('status')) {
                    console.log(`\n\n[FOUND MATcH DATA API] ${url}`);
                    console.log(`[PREVIEW] ${text.substring(0, 500)}`);
                }
            } catch (e) { }
        }
    });

    console.log("Navigating to https://colatv42.live...");
    await page.goto('https://colatv42.live', { waitUntil: 'networkidle', timeout: 15000 });
    console.log("Done");
    await browser.close();
})();
