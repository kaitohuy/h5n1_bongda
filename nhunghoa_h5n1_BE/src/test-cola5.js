const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('websocket', ws => {
        console.log(`[WS] Opened: ${ws.url()}`);
        ws.on('framesent', payload => console.log('[WS] Sent:', typeof payload === 'string' ? payload.substring(0, 200) : '<binary>'));
        ws.on('framereceived', payload => console.log('[WS] Recv:', typeof payload === 'string' ? payload.substring(0, 200) : '<binary>'));
    });

    console.log("Navigating to https://colatv42.live...");
    await page.goto('https://colatv42.live', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);

    console.log("Done");
    await browser.close();
})();
