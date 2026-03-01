const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating...");
    await page.goto('https://colatv42.live', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const matches = await page.evaluate(() => {
        const cards = document.querySelectorAll('.match-item, .match-card, a[href*="/truc-tiep/"]');
        return Array.from(cards).map(c => c.innerText.replace(/\n/g, ' - ')).slice(0, 5);
    });

    console.log("Matches:", matches);
    await browser.close();
})();
