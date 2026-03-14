const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Starting Playwright...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let logs = '';
    page.on('request', request => {
        const url = request.url();
        if (url.includes('api-gavang') || url.includes('graphql')) {
            let logStr = `URL: ${url}\nMethod: ${request.method()}\n`;
            if (request.method() === 'POST') {
                logStr += `Payload: ${request.postData()}\n`;
            }
            logs += logStr + '\n';
        }
    });

    console.log('Navigating to Live Match: https://xem1.gv05.live/truc-tiep/la-equidad-vs-america-de-cali-k82rekhg5o98rep');
    try {
        await page.goto('https://xem1.gv05.live/truc-tiep/la-equidad-vs-america-de-cali-k82rekhg5o98rep', { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
        console.log('Navigation timeout, but APIs might have loaded.');
    }

    fs.writeFileSync('live_match_apis.log', logs);
    console.log('Saved intercepted APIs to live_match_apis.log');

    await browser.close();
})();
