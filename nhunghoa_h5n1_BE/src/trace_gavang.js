const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating to https://xem1.gv05.live/ ...");

    let apis = new Set();
    
    page.on('request', req => {
        const url = req.url();
        if (url.includes('api-gavang') || url.includes('socket') || url.includes('ws') || url.includes('graphql')) {
            apis.add(url);
        }
    });
    
    page.on('websocket', ws => {
        console.log(`WebSocket opened: ${ws.url()}`);
        ws.on('framereceived', frame => {
            if (frame.payload && frame.payload.toString().length < 500) {
                console.log(`WS Frame Received:`, frame.payload.toString());
            } else {
                console.log(`WS Frame Received length: ${frame.payload.byteLength}`);
            }
        });
    });

    try {
        await page.goto('https://xem1.gv05.live/', { waitUntil: 'networkidle', timeout: 15000 });
        console.log("Page loaded. Waiting 10 seconds to capture background requests or WS connections...");
        await page.waitForTimeout(10000);
        
        console.log("\nCaptured API URLs:");
        Array.from(apis).forEach(u => console.log(u));
        
    } catch(e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
run();
