/**
 * scraper_gavang.js — GavangTV scraper
 *
 * Match listing : Direct GraphQL API (api-gavang.gvtv1.com) — no browser needed (~200ms!)
 * Stream URL    : /match/{id}/live API first, fallback to Playwright if not live
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());

const GAVANG_BASE = 'https://xem1.gv05.live';
const GAVANG_API = 'https://api-gavang.gvtv1.com';

const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': GAVANG_BASE,
    'Referer': GAVANG_BASE + '/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
};

const DEFAULT_TIMEOUT_MS = 25000;

const CONTEXT_OPTIONS = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
};

// ── Cache ─────────────────────────────────────────────────────────────────────
let matchCache = { data: { matches: [], hasMore: false }, expiresAt: 0 };
const CACHE_TTL = 3 * 60 * 1000; // 3 phút

// ── GraphQL Query ─────────────────────────────────────────────────────────────
const MATCHES_QUERY = `{
  matches {
    id slug team_1 team_2 league
    team_1_logo team_2_logo
    team_1_score team_2_score
    start_date status is_live is_hot is_top
    blv desc source_live
  }
}`;

// ── Map API status → app status ───────────────────────────────────────────────
function mapStatus(m) {
    if (m.is_live) return 'Trực tiếp';
    // status field: "scheduled" | "live" | "ended" | ...
    const s = (m.status || '').toLowerCase();
    if (s.includes('live') || s.includes('playing')) return 'Trực tiếp';
    if (s.includes('end') || s.includes('finish') || s.includes('ft')) return 'Đã kết thúc';
    return 'Sắp tới';
}

// ── Parse start_date "2026-03-08 14:00:00" → { time: "14:00", date: "08/03" } ─
function parseDate(str) {
    if (!str) return { time: '--:--', date: '' };
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!m) return { time: '--:--', date: '' };
    return { time: `${m[4]}:${m[5]}`, date: `${m[3]}/${m[2]}` };
}

// ── Build sourceUrl từ match ID (slugs always null in API response) ──────────
function buildSourceUrl(m) {
    // API không trả về slug, nhưng source_live có thể là stream URL trực tiếp
    // sourceUrl dùng để load page qua Playwright nếu source_live null
    if (m.source_live) return m.source_live; // m3u8 URL trực tiếp!
    if (!m.id) return '';
    // Fallback: build gavang URL từ id (pattern từ actual links)
    return '';
}

// ── Fetch match list từ GraphQL API ──────────────────────────────────────────
async function fetchFromAPI() {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ query: MATCHES_QUERY }),
            signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = await res.json();
        const arr = json.data || json.matches || [];
        if (!Array.isArray(arr)) throw new Error('API returned non-array');

        // Chỉ lấy FOOTBALL, loại VOLLEYBALL và các môn khác
        const football = arr.filter(m => !m.desc || m.desc.toUpperCase() === 'FOOTBALL');

        return football.map((m, i) => {
            const { time, date } = parseDate(m.start_date);
            const mappedStatus = mapStatus(m);
            const sourceLive = m.source_live || null; // m3u8 URL trực tiếp nếu có
            return {
                id: 'gv_' + (m.id || i),
                home: m.team_1 || 'Đội nhà',
                away: m.team_2 || 'Đội khách',
                homeLogo: m.team_1_logo || '',
                awayLogo: m.team_2_logo || '',
                leagueId: '',
                leagueLogo: '',
                league: m.league || 'Không rõ',
                time,
                date,
                status: mappedStatus,
                minute: m.is_live ? 'LIVE' : '',
                homeScore: m.is_live || mappedStatus === 'Đã kết thúc' ? (m.team_1_score ?? null) : null,
                awayScore: m.is_live || mappedStatus === 'Đã kết thúc' ? (m.team_2_score ?? null) : null,
                isHot: Boolean(m.is_hot || m.is_top),
                isSuperHot: false,
                commentator: m.blv || '',
                section: m.is_live ? 'live' : (m.is_hot || m.is_top ? 'hot' : 'other'),
                sourceUrl: sourceLive || '', // sourceUrl dùng cho Playwright fallback; nếu null thì không click được
                sourceLive,                  // m3u8 trực tiếp (nếu API đã cung cấp)
                _apiId: m.id,
            };
        });
    } catch (e) {
        clearTimeout(t);
        throw e;
    }
}

// ── Public: fetchGavangMatches ────────────────────────────────────────────────
async function fetchGavangMatches(loadMore = false) {
    // loadMore không còn cần thiết (API trả đủ data trong 1 request)
    // Giữ tham số để tương thích với code hiện tại
    if (Date.now() < matchCache.expiresAt && matchCache.data.matches.length > 0) {
        return matchCache.data;
    }

    console.log('[gavang] Fetching matches from GraphQL API...');
    const start = Date.now();
    try {
        const matches = await fetchFromAPI();
        const hasMore = false; // API trả đủ rồi
        console.log(`[gavang] Got ${matches.length} football matches in ${Date.now() - start}ms`);
        matchCache = { data: { matches, hasMore }, expiresAt: Date.now() + CACHE_TTL };
        return matchCache.data;
    } catch (e) {
        console.error('[gavang] API fetch failed:', e.message);
        // Nếu có cache cũ → trả về fallback
        if (matchCache.data.matches.length > 0) {
            console.log('[gavang] Serving stale cache as fallback');
            return matchCache.data;
        }
        return { matches: [], hasMore: false };
    }
}

// ── Browser Singleton (chỉ dùng cho stream extraction) ────────────────────────
let sharedBrowser = null;

async function getSharedBrowser() {
    if (sharedBrowser) {
        try { await sharedBrowser.version(); return sharedBrowser; } catch { sharedBrowser = null; }
    }
    console.log('[gavang] Launching browser for stream extraction...');
    sharedBrowser = await chromium.launch({ headless: true });
    return sharedBrowser;
}

// Keepalive: ping browser định kỳ để tránh bị OS kill
setInterval(async () => {
    if (sharedBrowser) {
        try { await sharedBrowser.version(); } catch { sharedBrowser = null; }
    }
}, 60 * 1000);

async function createBypassPage(browser) {
    const context = await browser.newContext(CONTEXT_OPTIONS);
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    // Block non-essential resources
    await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        const url = route.request().url();
        if (['image', 'media', 'font', 'stylesheet'].includes(type)
            || url.includes('guard_v1.js') || url.includes('analytics') || url.includes('google')) {
            return route.abort();
        }
        return route.continue();
    });
    return { context, page };
}

// ── Stream extraction ─────────────────────────────────────────────────────────
async function extractGavangStream(targetUrl, requestedServer = null) {
    // Bước 1: Nếu targetUrl chính là m3u8 URL (source_live từ API) — trả về luôn!
    if (targetUrl && (targetUrl.includes('.m3u8') || targetUrl.includes('.flv'))) {
        console.log(`[gavang] source_live is direct stream URL, returning immediately`);
        return { streamUrl: targetUrl, iframeSrc: null, servers: [] };
    }

    // Bước 2: Thử lấy stream URL từ API /match/{id}/live (nhanh ~200ms)
    const apiId = extractApiIdFromUrl(targetUrl);
    if (apiId) {
        try {
            const streamData = await fetchLiveStreamFromAPI(apiId);
            if (streamData) {
                console.log(`[gavang] Got stream from API: ${streamData.streamUrl}`);
                return streamData;
            }
        } catch (e) {
            console.log('[gavang] API stream fetch failed, falling back to Playwright:', e.message);
        }
    }

    // Bước 3: Fallback về Playwright (khi sourceUrl là trang web, không phải m3u8)
    if (!targetUrl) {
        console.log('[gavang] No targetUrl, cannot extract stream');
        return null;
    }
    return extractGavangStreamPlaywright(targetUrl, requestedServer);
}

// Lấy API id từ sourceUrl (gv_id hoặc từ slug)
function extractApiIdFromUrl(url) {
    // Thử tìm id trong matchCache
    const cached = matchCache.data.matches.find(m => m.sourceUrl === url);
    return cached && cached._apiId ? cached._apiId : null;
}

// Lấy stream URL từ API /match/{id}/live
async function fetchLiveStreamFromAPI(apiId) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${GAVANG_API}/match/${apiId}/live`, {
            headers: API_HEADERS,
            signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null; // 404 = chưa live
        const data = await res.json();
        // Tìm stream URL trong response
        const streamUrl = data.stream_url || data.url || data.m3u8 || data.hls;
        if (!streamUrl) return null;
        return { streamUrl, iframeSrc: null, servers: [] };
    } catch {
        clearTimeout(t);
        return null;
    }
}

// Playwright fallback cho stream extraction
async function extractGavangStreamPlaywright(targetUrl, requestedServer = null) {
    let browser = null;
    try {
        // Luon launch browser RIENG cho stream extraction
        // Tranh tranh tai nguyen CPU voi fetchGavangMatches
        browser = await chromium.launch({ headless: true });
        const { context, page } = await createBypassPage(browser);

        // Override route để bắt được media requests (tránh block quá mạnh)
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            const url = route.request().url();
            if (['image', 'font', 'stylesheet'].includes(type)
                || url.includes('guard_v1.js') || url.includes('google')) {
                return route.abort();
            }
            return route.continue();
        });

        console.log(`[gavang] Extracting stream via Playwright from ${targetUrl}...`);

        let foundM3u8 = null;
        let foundFlv = null;
        const captureUrl = (url) => {
            if (url.includes('.m3u8')) foundM3u8 = url;
            else if (url.includes('.flv')) foundFlv = url;
        };
        page.on('request', req => captureUrl(req.url()));
        page.on('response', resp => captureUrl(resp.url()));

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS }).catch(() => { });

        // Click play button nhanh
        try { await page.click('#player, .play-btn, .vjs-big-play-button', { timeout: 500 }); } catch { }

        // Poll deadline: 8s local, 30s Render
        const POLL_DEADLINE_MS = process.env.RENDER ? 30000 : 8000;
        let deadline = Date.now() + POLL_DEADLINE_MS;
        while (!foundM3u8 && !foundFlv && Date.now() < deadline) {
            await page.waitForTimeout(100);
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
            } catch { }
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
                        if (await el.isVisible()) { await el.click({ timeout: 2000 }); clicked = true; break; }
                    }
                    if (clicked) break;
                } catch { }
            }
            if (clicked) {
                deadline = Date.now() + POLL_DEADLINE_MS;
                while (!foundM3u8 && !foundFlv && Date.now() < deadline) {
                    await page.waitForTimeout(100);
                }
            } else {
                console.log(`[gavang] Could not click requested server: ${requestedServer}`);
            }
        }

        const streamUrl = foundM3u8 || foundFlv;
        if (streamUrl) {
            console.log(`[gavang] Found stream: ${streamUrl}`);
            await context.close();
            return { streamUrl, iframeSrc: targetUrl, servers: availableServers };
        }

        console.log('[gavang] No stream URL found');
        await context.close();
        return null;

    } catch (e) {
        console.error('[gavang] Error extracting stream:', e.message);
        sharedBrowser = null;
        return null;
    } finally {
        if (browser) { try { await browser.close(); } catch { } }
    }
}

module.exports = {
    fetchGavangMatches,
    extractGavangStream,
    clearCache: () => {
        matchCache = { data: { matches: [], hasMore: false }, expiresAt: 0 };
        console.log('[gavang] Cache cleared');
    }
};

// Pre-warm cache ngay khi module load
setTimeout(() => {
    console.log('[gavang] Pre-warming cache on startup...');
    fetchGavangMatches(false).catch(e => console.error('[gavang] Startup pre-warm failed:', e.message));
}, 1000);
