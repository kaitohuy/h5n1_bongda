const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating to https://colatv.live...");
    await page.goto('https://colatv.live', { waitUntil: 'networkidle', timeout: 20000 });

    // Wait for the skeleton to disappear or for .match-card to be present
    try {
        await page.waitForSelector('.match-card', { timeout: 10000 });
        console.log("Match cards found!");
    } catch (e) {
        console.log("No match cards found within 10s.");
    }

    // Extract match titles as proof
    const titles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.match-title, .match-card, .team-name')).map(el => el.textContent.trim()).slice(0, 50);
    });
    console.log("Sample Extracted Text:", titles);

    await browser.close();
})();
