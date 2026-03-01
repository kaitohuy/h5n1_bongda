const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating to https://colatv42.live...");
    await page.goto('https://colatv42.live', { waitUntil: 'domcontentloaded' });

    const html = await page.content();
    fs.writeFileSync('colatv.html', html);
    console.log("Saved colatv.html, length:", html.length);

    // Look for __NEXT_DATA__
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">({.*?})<\/script>/);
    if (match) {
        fs.writeFileSync('colatv.json', match[1]);
        console.log("Saved colatv.json, length:", match[1].length);
    }
    await browser.close();
})();
