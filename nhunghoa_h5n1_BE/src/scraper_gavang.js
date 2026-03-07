const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());

const GAVANG_BASE = 'https://xem1.gv05.live';

// Default timeout
const DEFAULT_TIMEOUT_MS = 25000;

const CONTEXT_OPTIONS = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
};

// Caches
let gavangMatchesCache = { data: { matches: [], hasMore: false }, expiresAt: 0 }; // fast
let gavangFullCache = { data: { matches: [], hasMore: false }, expiresAt: 0 }; // full
const CACHE_TTL = 3 * 60 * 1000; // 3 phút

let warmingUpPromise = null;
async function warmUpFullCache() {
    if (warmingUpPromise) return warmingUpPromise;
    if (Date.now() < gavangFullCache.expiresAt && gavangFullCache.data && gavangFullCache.data.matches && gavangFullCache.data.matches.length > 0) return Promise.resolve();

    console.log('[gavang] Background warming up full cache (loadMore=true)...');
    warmingUpPromise = fetchGavangMatches(true).catch(e => {
        console.error('[gavang] Background warm up failed:', e.message);
    }).finally(() => {
        warmingUpPromise = null;
    });
    return warmingUpPromise;
}


// ── Browser Singleton ────────────────────────────────────────────────────────
// Duy trì 1 browser instance duy nhất, tái sử dụng cho mọi lần scrape.
// Tránh tốn ~5s khởi động browser mỗi lần cache hết hạn.
let sharedBrowser = null;

async function getSharedBrowser() {
    if (sharedBrowser) {
        try {
            // Kiểm tra browser còn sống không (ping nhanh)
            await sharedBrowser.version();
            return sharedBrowser;
        } catch {
            // Browser đã chết - cần khởi động lại
            sharedBrowser = null;
        }
    }
    console.log('[gavang] Launching new browser instance...');
    sharedBrowser = await chromium.launch({ headless: true });
    return sharedBrowser;
}

async function createBypassPage(browser) {
    const context = await browser.newContext(CONTEXT_OPTIONS);
    // Hide webdriver to bypass Cloudflare
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });

    const page = await context.newPage();

    // Block tracking/guard scripts that cause infinite bot-loops
    await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.includes("guard_v1.js") || url.includes("analytics") || url.includes("google")) {
            route.abort();
        } else {
            route.continue();
        }
    });

    return { context, page };
}

async function fetchGavangMatches(loadMore = false) {
    if (loadMore && warmingUpPromise) {
        console.log('[gavang] Waiting for existing background warmup to finish...');
        await warmingUpPromise;
        const cache = gavangFullCache;
        if (Date.now() < cache.expiresAt && cache.data && cache.data.matches.length > 0) {
            return cache.data;
        }
    }

    const cache = loadMore ? gavangFullCache : gavangMatchesCache;
    if (Date.now() < cache.expiresAt && cache.data && cache.data.matches.length > 0) {
        return cache.data;
    }


    let page = null;
    let context = null;
    try {
        const browser = await getSharedBrowser();
        const { context: ctx, page: pg } = await createBypassPage(browser);
        context = ctx;
        page = pg;

        console.log(`[gavang] Fetching homepage matches... (loadMore=${loadMore})`);
        await page.goto(`${GAVANG_BASE}/trang-chu`, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS });

        // Chờ JS render (2.5s — đủ cho Cloudflare challenge)
        await page.waitForTimeout(2500);

        // Chỉ click "Xem thêm" khi người dùng thực sự yêu cầu loadMore
        if (loadMore) {
            try {
                await page.evaluate(async () => {
                    const sleep = ms => new Promise(r => setTimeout(r, ms));
                    let clicked = true;
                    let attempts = 0;
                    while (clicked && attempts < 30) {
                        clicked = false;
                        attempts++;
                        const buttons = Array.from(document.querySelectorAll('a, button, div, span, p')).filter(el => {
                            const t = el.innerText ? el.innerText.toLowerCase() : '';
                            const style = window.getComputedStyle(el);
                            return t.includes('xem thêm') && style.display !== 'none';
                        });
                        for (const btn of buttons) {
                            try { btn.click(); clicked = true; await sleep(700); } catch (e) { }
                        }
                    }
                });
            } catch (e) {
                console.error('[gavang] Auto click error:', e.message);
            }
        }

        const payload = await page.evaluate((base) => {

            const results = [];
            // Parse all headers and match items in document order to track sections
            const allNodes = document.querySelectorAll('h1, h2, h3, h4, .title, .title-box, a[href^="/truc-tiep/"]');

            let currentSection = '';

            allNodes.forEach((el, index) => {
                const tag = el.tagName.toLowerCase();
                const textContent = el.textContent.trim().toLowerCase();

                // If it's a section title, remember it
                if (tag !== 'a') {
                    if (textContent.includes('hot')) currentSection = 'hot';
                    else if (textContent.includes('diễn ra') || textContent.includes('live')) currentSection = 'live';
                    else if (textContent.includes('hôm nay')) currentSection = 'today';
                    return;
                }

                const link = el.getAttribute('href');
                if (!link) return;

                // Get all direct text parts
                const texts = [];
                const allElements = el.querySelectorAll('*');
                allElements.forEach(e => {
                    // Extract direct text node only
                    let child = e.firstChild;
                    while (child) {
                        if (child.nodeType === 3) {
                            const t = child.textContent.replace(/\s+/g, ' ').trim();
                            // Do NOT deduplicate here, so 0 - 0 doesn't lose the second 0
                            if (t) texts.push(t);
                        }
                        child = child.nextSibling;
                    }
                });

                // Extract Images
                const imgs = Array.from(el.querySelectorAll('img')).map(img => img.src).filter(src => src);

                if (texts.length < 4) return; // invalid item

                // texts usually looks like:
                // Sắp đấu | Spanish La Liga | Real Madrid | 0 | - | Getafe | 03:00 03/03
                // Or: Live | Indonesian Liga 1 | Makassar | 2 | - | 4 | Tangerang | 20:30 02/03

                const statusType = texts[0] || 'Sắp đấu';
                // Scan all texts for live/ht/ft indicator — texts[0] might be 'HOT' badge for hot+live matches
                const isLiveByText = texts.some(t => t.toLowerCase() === 'live' || t.toLowerCase() === 'trực tiếp');
                let mappedStatus = 'Sắp tới';
                if (isLiveByText || currentSection === 'live') {
                    mappedStatus = 'Trực tiếp';
                }
                const allTextsLower = texts.join(' ').toLowerCase();
                if (allTextsLower.includes(' ht ') || allTextsLower.includes(' ft ') ||
                    statusType.toLowerCase() === 'ht' || statusType.toLowerCase() === 'ft') {
                    mappedStatus = 'Đã kết thúc';
                }

                // texts[1..3] có thể là phút thi đấu (e.g. '73\'', '65\u2032', '45+2\'')
                // Mở rộng regex: bao gồm prime \u2032, hầu hết các dạng dấu nháy
                // Scan nhiều vị trí vì badge HOT/SUPERHOT có thể đẩy minute sang phải
                // texts[] chứa phút thi đấu (e.g. '73\'', '65\u2032') và tên giải đấu
                // Tách biệt: minute PHẢI có ký tự phút ở cuối; league là text đầu tiên không phải status/time/minute/số
                const minutePattern = /^\d{1,3}([+]\d{0,2})?['\u2019\u2032\u0060]$/;
                const STATUS_WORDS_RE = /^(live|tr\u1ef1c ti\u1ebfp|s\u1eafp \u0111\u1ea5u|hot|superhot|super hot|ht|ft|k\u1ebft th\u00fac)$/i;
                const TIME_RE = /^\d{2}:\d{2}/;
                let gameMinute = '';
                // Tìm minute trong texts[1..4]
                for (let mi = 1; mi <= 4; mi++) {
                    if (texts[mi] && minutePattern.test(texts[mi].trim())) {
                        gameMinute = texts[mi].trim();
                        break;
                    }
                }
                // Nếu tìm được phút thi đấu → trận chắc chắn đang live
                const isLive = isLiveByText || !!gameMinute || currentSection === 'live';
                if (isLive && mappedStatus !== '\u0110\u00e3 k\u1ebft th\u00fac') {
                    mappedStatus = 'Tr\u1ef1c ti\u1ebfp';
                }
                // Tìm tên giải đấu: text đầu tiên không phải status word, không phải time, không phải minute, không phải số thuần túy
                const league = texts.find(t => {
                    const s = t.trim();
                    return s.length >= 3
                        && !STATUS_WORDS_RE.test(s)
                        && !TIME_RE.test(s)
                        && !minutePattern.test(s)
                        && !/^\d+$/.test(s)
                        && !/^[-\u2013\u2014:]$/.test(s);
                }) || '';

                // time regex \d{2}:\d{2} \d{2}/\d{2}
                const timeIndex = texts.findIndex(t => /\d{2}:\d{2}\s+\d{2}\/\d{2}/.test(t)) || texts.findIndex(t => /\d{2}:\d{2}/.test(t));
                const timeStr = timeIndex !== -1 && timeIndex !== false && timeIndex !== true ? texts[timeIndex] : '--:--';
                const timeMatch = timeStr ? timeStr.match(/(\d{2}:\d{2})/) : null;
                const time = timeMatch ? timeMatch[1] : '--:--';
                const dateMatch = timeStr ? timeStr.match(/(\d{2}\/\d{2})/) : null;
                const date = dateMatch ? dateMatch[1] : '';

                // Parse teams from URL slug: /truc-tiep/home-team-vs-away-team-id
                const slugMatch = link.match(/\/truc-tiep\/(.+?)-vs-(.+?)-[a-z0-9]+$/);
                let home = 'Đội nhà';
                let away = 'Đội khách';
                if (slugMatch) {
                    home = slugMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    away = slugMatch[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }

                // ── Parse score từ innerText thô ────────────────────────────────
                let homeScore = null;
                let awayScore = null;

                // Cách 1a: tìm score element theo class phổ biến
                const scoreEl = el.querySelector('[class*="score"], [class*="Score"], [class*="result"], [class*="Result"], [class*="ty-so"], [class*="tiso"], [class*="sbd"]');
                if (scoreEl) {
                    const scoreText = scoreEl.innerText || scoreEl.textContent || '';
                    const m = scoreText.match(/(\d+)\s*[:\-\u2013\u2014]\s*(\d+)/);
                    if (m) {
                        homeScore = parseInt(m[1], 10);
                        awayScore = parseInt(m[2], 10);
                    }
                }

                // Cách 1b: tìm 2 span/div số nằm kề nhau, cách nhau bởi dấu '-' hoặc ':'
                if (homeScore === null) {
                    const numEls = Array.from(el.querySelectorAll('span, div, b, strong')).filter(e => /^\d+$/.test((e.innerText || e.textContent || '').trim()));
                    if (numEls.length >= 2) {
                        // Tìm cặp số liên tiếp gần nhau trong DOM (bên trái & bên phải của separator)
                        for (let ni = 0; ni < numEls.length - 1; ni++) {
                            const a = parseInt((numEls[ni].innerText || '').trim(), 10);
                            const b = parseInt((numEls[ni + 1].innerText || '').trim(), 10);
                            if (!isNaN(a) && !isNaN(b)) {
                                // Kiểm tra giữa 2 số có ký tự separator không
                                const between = numEls[ni].nextSibling;
                                const betweenText = between ? (between.textContent || '').trim() : '';
                                if (!betweenText || /^[:\-\u2013\u2014\s]+$/.test(betweenText)) {
                                    homeScore = a;
                                    awayScore = b;
                                    break;
                                }
                            }
                        }
                    }
                }

                // Cách 2: tìm trong texts[] dấu '-' hoặc các Unicode dash, có số ở 2 bên
                if (homeScore === null) {
                    // Tìm index của dấu separator (-, –, —, :) đứng riêng trong mảng
                    const dashIndex = texts.findIndex(t => /^[\-\u2013\u2014:]$/.test(t.trim()));
                    if (dashIndex > 0) {
                        const prevText = (texts[dashIndex - 1] || '').trim();
                        const nextText = (texts[dashIndex + 1] || '').trim();
                        const prevNum = parseInt(prevText, 10);
                        const nextNum = parseInt(nextText, 10);
                        if (!isNaN(prevNum) && /^\d+$/.test(prevText)) homeScore = prevNum;
                        if (!isNaN(nextNum) && /^\d+$/.test(nextText)) awayScore = nextNum;
                    }
                }

                // Cách 3: fallback — scan toàn bộ innerText tìm pattern "X - Y" hoặc "X:Y" (bao gồm Unicode dashes)
                if (homeScore === null) {
                    const rawText = el.innerText || el.textContent || '';
                    const m = rawText.match(/\b(\d+)\s*[:\-\u2013\u2014]\s*(\d+)\b/);
                    if (m) {
                        homeScore = parseInt(m[1], 10);
                        awayScore = parseInt(m[2], 10);
                    }
                }

                // Logos (first 2 images are usually badges/hot tags, next 2 are teams)
                const teamLogos = imgs.filter(src => src.includes('team') || src.includes('flashscore'));

                // Detect "Gà Siêu Mồm" / SUPER HOT — gavang.tv đánh dấu thủ công bằng text hoặc badge ảnh
                const innerText = (el.innerText || el.textContent || '').toLowerCase();
                const isSuperHot = innerText.includes('gà siêu') || innerText.includes('ga sieu') ||
                    imgs.some(src => src.toLowerCase().includes('super'));

                // Tìm tên BLV — tên BLV thường xuất hiện kèm icon 🎧, text "Gà Siêu..."
                // Lấy text node TRỰC TIẾP (không lấy innerText vì sẽ gộp cả text con)
                let commentator = '';
                const NOISE_WORDS = /xem ngay|đặt cược|hot|live|trực tiếp|sắp đấu|lịch|thêm/i;

                // Cách 1: tìm element có class liên quan đến blv/anchor
                const blvEl = el.querySelector('[class*="blv"], [class*="BLV"], [class*="commentator"], [class*="host"], [class*="ga-sieu"], [class*="anchor"]');
                if (blvEl) {
                    // Chỉ lấy text node trực tiếp của element, không lấy text con
                    let direct = '';
                    blvEl.childNodes.forEach(n => { if (n.nodeType === 3) direct += n.textContent; });
                    commentator = direct.replace('🎧', '').trim();
                }

                // Cách 2: tìm span/div nhỏ nhất chứa "Gà" hoặc "🎧" — ưu tiên leaf node
                if (!commentator) {
                    const allEls = Array.from(el.querySelectorAll('span, div, p, a'));
                    for (const s of allEls) {
                        // Bỏ qua nếu có nhiều child element (tránh lấy container cha)
                        if (s.children.length > 1) continue;
                        // Lấy text trực tiếp (direct text nodes only)
                        let directText = '';
                        s.childNodes.forEach(n => { if (n.nodeType === 3) directText += n.textContent; });
                        directText = directText.replace('🎧', '').trim();
                        if (!directText) continue;
                        // Phải bắt đầu bằng "Gà" hoặc "Ga" (case-insensitive)
                        if (/^G[aà]\s/i.test(directText) && !NOISE_WORDS.test(directText)) {
                            commentator = directText;
                            break;
                        }
                    }
                }

                // Cách 3: scan texts[] tìm "Gà ..." pattern (mảng đã tách riêng từng text node)
                if (!commentator) {
                    const blvText = texts.find(t => /^G[aà]\s/i.test(t.trim()) && !NOISE_WORDS.test(t));
                    if (blvText) commentator = blvText.trim();
                }

                results.push({
                    id: 'gv_' + index + '_' + link.split('-').pop(), // pseudo unique id
                    home: home,
                    away: away,
                    homeLogo: teamLogos[0] || '',
                    awayLogo: teamLogos[1] || '',
                    leagueId: '',
                    leagueLogo: '',
                    league: league,
                    time: time,
                    date: date,
                    status: mappedStatus,
                    minute: isLive ? (gameMinute || 'LIVE') : '',
                    homeScore: homeScore,
                    awayScore: awayScore,
                    isHot: currentSection === 'hot' || imgs.some(src => src.includes('hot')),
                    isSuperHot: isSuperHot,
                    commentator: commentator,
                    section: currentSection || 'other',
                    sourceUrl: link.startsWith('http') ? link : base + link
                });
            });

            // remove duplicates
            const unique = [];
            const urls = new Set();
            results.forEach(r => {
                if (!urls.has(r.sourceUrl)) {
                    urls.add(r.sourceUrl);
                    unique.push(r);
                }
            });
            // Check if there are still any "xem thêm" buttons visible
            const stillHasMore = Array.from(document.querySelectorAll('a, button, div, span, p')).some(el => {
                const t = el.innerText ? el.innerText.toLowerCase() : '';
                const style = window.getComputedStyle(el);
                return t.includes('xem th\u00eam') && style.display !== 'none';
            });

            return { unique, stillHasMore };
        }, GAVANG_BASE);

        const matches = payload.unique;
        const hasMore = payload.stillHasMore;

        console.log(`[gavang] Scraped ${matches.length} matches (loadMore=${loadMore}, hasMore=${hasMore})`);

        const cacheData = { matches, hasMore };
        if (loadMore) {
            gavangFullCache = { data: cacheData, expiresAt: Date.now() + CACHE_TTL };
        } else {
            gavangMatchesCache = { data: cacheData, expiresAt: Date.now() + CACHE_TTL };
            // Trigger background pre-fetch (luồng tách biệt, không dùng await để browser client tiếp tục nhận phản hồi 6s ngay lập tức)
            warmUpFullCache().catch(e => console.error("Warmup logic error:", e));
        }

        return cacheData;

    } catch (e) {
        console.error('[gavang] Error fetching matches:', e.message);
        // Nếu browser lỗi, reset singleton để lần sau tạo lại
        sharedBrowser = null;
        return { matches: [], hasMore: false };
    } finally {
        // Chỉ đóng context/page (không đóng browser - để tái sử dụng)
        if (context) {
            try { await context.close(); } catch { }
        }
    }
}

async function extractGavangStream(targetUrl, requestedServer = null) {
    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const { page } = await createBypassPage(browser);

        // Abort media requests to save bandwidth during extraction
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            const url = route.request().url();
            if (['image', 'media', 'font', 'stylesheet'].includes(type) || url.includes("guard_v1.js") || url.includes("google")) {
                return route.abort();
            }
            return route.continue();
        });

        console.log(`[gavang] Extracting stream from ${targetUrl}...`);

        let foundM3u8 = null;
        let foundFlv = null;
        page.on('request', req => {
            const url = req.url();
            if (url.includes('.m3u8')) foundM3u8 = url;
            else if (url.includes('.flv')) foundFlv = url;
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS }).catch(() => { });

        // GavangTV doesn't have an iframe, they inject player directly or load iframe after click
        // Click the play button or wait
        try {
            await page.click('#player, .play-btn, .vjs-big-play-button', { timeout: 3000 });
        } catch { }

        // wait for initial stream
        let deadline = Date.now() + 10000;
        while (!foundM3u8 && !foundFlv && Date.now() < deadline) {
            await page.waitForTimeout(500);
        }

        // Find available servers
        let availableServers = [];
        for (const frame of page.frames()) {
            try {
                const els = await frame.$$('a:has-text("Việt Nam"), button:has-text("Việt Nam"), span:has-text("Việt Nam"), li:has-text("Việt Nam"), div.server:has-text("Việt Nam"), a:has-text("Quốc Tế"), button:has-text("Quốc Tế"), span:has-text("Quốc Tế"), li:has-text("Quốc Tế"), div.server:has-text("Quốc Tế"), a:has-text("Nhà đài"), button:has-text("Nhà đài"), span:has-text("Nhà đài"), li:has-text("Nhà đài"), div.server:has-text("Nhà đài")');
                for (const el of els) {
                    if (await el.isVisible()) {
                        const text = (await el.innerText()).replace(/[\r\n]+/g, ' ').trim();
                        if (text && text.length < 20 && !availableServers.includes(text)) {
                            availableServers.push(text);
                        }
                    }
                }
            } catch (e) { }
        }
        availableServers = [...new Set(availableServers)];

        if (requestedServer) {
            console.log(`[gavang] Switching to requested server: ${requestedServer}`);
            foundM3u8 = null;
            foundFlv = null;
            let clicked = false;

            for (const frame of page.frames()) {
                try {
                    const els = await frame.$$(`a:has-text("${requestedServer}"), button:has-text("${requestedServer}"), span:has-text("${requestedServer}"), li:has-text("${requestedServer}"), div.server:has-text("${requestedServer}")`);
                    for (const el of els) {
                        if (await el.isVisible()) {
                            await el.click({ timeout: 2000 });
                            clicked = true;
                            break;
                        }
                    }
                    if (clicked) break;
                } catch (e) { }
            }

            if (clicked) {
                deadline = Date.now() + 10000;
                while (!foundM3u8 && !foundFlv && Date.now() < deadline) {
                    await page.waitForTimeout(500);
                }
            } else {
                console.log(`[gavang] Could not click requested server: ${requestedServer}`);
            }
        }

        const streamUrl = foundM3u8 || foundFlv;
        if (streamUrl) {
            console.log(`[gavang] Found stream: ${streamUrl}`);
            return { streamUrl, iframeSrc: targetUrl, servers: availableServers };
        }

        console.log(`[gavang] No stream URL found`);
        return null;

    } catch (e) {
        console.error('[gavang] Error extracting stream:', e.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = {
    fetchGavangMatches,
    extractGavangStream,
    clearCache: () => {
        gavangMatchesCache = { data: [], expiresAt: 0 };
        console.log('[gavang] Cache cleared');
    }
};

