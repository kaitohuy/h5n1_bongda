const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs = require('fs');

async function interceptHome() {
    console.log('Khởi chạy Playwright để bắt API danh sách trận...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
    });

    // Bypass guard
    const page = await context.newPage();
    await page.route('**/*', route => {
        if (route.request().url().includes('guard_v1.js') ||
            route.request().resourceType() === 'image' ||
            route.request().resourceType() === 'stylesheet' ||
            route.request().resourceType() === 'font') {
            return route.abort();
        }
        route.continue();
    });

    // Lắng nghe tất cả response có dạng JSON
    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('api') || url.includes('json') || url.includes('match')) {
            try {
                const text = await res.text();
                // Check if it looks like JSON
                if (text.startsWith('{') || text.startsWith('[')) {
                    console.log(`\n\n[API FOUND] URL: ${url}`);
                    fs.appendFileSync('intercepted_apis.log', `URL: ${url}\n${text}\n\n`);
                    console.log(`Đã lưu response của ${url} vào intercepted_apis.log`);
                }
            } catch (e) { }
        }
    });

    console.log('Đang truy cập https://xem1.gv05.live/ ...');
    await page.goto('https://xem1.gv05.live/', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Đã load xong trang chủ. Chờ thêm 3s để bắt các API gọi muộn...');
    await page.waitForTimeout(3000);

    await browser.close();
    console.log('Hoàn tất. Bạn có thể xem file intercepted_apis.log');
}
interceptHome().catch(console.error);
