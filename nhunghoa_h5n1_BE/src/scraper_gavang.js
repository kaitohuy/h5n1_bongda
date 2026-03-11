/**
 * scraper_gavang.js — GavangTV scraper
 *
 * Match listing : Direct GraphQL API (api-gavang.gvtv1.com) — no browser needed (~200ms!)
 * Stream URL    : /match/{id}/live API direct fetch. (Token generated serverside!)
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
    const s = (m.status || '').toLowerCase();
    if (s.includes('live') || s.includes('playing')) return 'Trực tiếp';
    if (s.includes('end') || s.includes('finish') || s.includes('ft')) return 'Đã kết thúc';
    return 'Sắp tới';
}

function parseDate(str) {
    if (!str) return { time: '--:--', date: '' };
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!m) return { time: '--:--', date: '' };
    return { time: `${m[4]}:${m[5]}`, date: `${m[3]}/${m[2]}` };
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

        // Chỉ lấy FOOTBALL
        const football = arr.filter(m => !m.desc || m.desc.toUpperCase() === 'FOOTBALL');

        return football.map((m, i) => {
            const { time, date } = parseDate(m.start_date);
            const mappedStatus = mapStatus(m);
            // Thủ thuật: Đặt sourceUrl chính là API endpoint để bypass Playwright 100%
            const fakeSourceUrl = `${GAVANG_API}/match/${m.id}/live`;
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
                sourceUrl: fakeSourceUrl,
            };
        });
    } catch (e) {
        clearTimeout(t);
        throw e;
    }
}

// ── Public: fetchGavangMatches ────────────────────────────────────────────────
async function fetchGavangMatches(loadMore = false) {
    if (Date.now() < matchCache.expiresAt && matchCache.data.matches.length > 0) {
        return matchCache.data;
    }

    console.log('[gavang] Fetching matches from GraphQL API...');
    const start = Date.now();
    try {
        const matches = await fetchFromAPI();
        const hasMore = false;
        console.log(`[gavang] Got ${matches.length} football matches in ${Date.now() - start}ms`);
        matchCache = { data: { matches, hasMore }, expiresAt: Date.now() + CACHE_TTL };
        return matchCache.data;
    } catch (e) {
        console.error('[gavang] API fetch failed:', e.message);
        if (matchCache.data.matches.length > 0) {
            console.log('[gavang] Serving stale cache as fallback');
            return matchCache.data;
        }
        return { matches: [], hasMore: false };
    }
}

// ── Stream extraction ─────────────────────────────────────────────────────────
async function extractGavangStream(targetUrl, requestedServer = null) {
    // 1. Nếu sourceUrl là API endpoint được set ở trên
    if (targetUrl && targetUrl.includes('api-gavang.gvtv1.com/match/')) {
        console.log(`[gavang] Extracting stream directly from API: ${targetUrl}`);
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6000);
        try {
            const res = await fetch(targetUrl, { headers: API_HEADERS, signal: controller.signal });
            clearTimeout(t);
            if (!res.ok) {
                console.log(`[gavang] API returned ${res.status} (match probably not live)`);
                return null;
            }
            const data = await res.json();

            // API returns: { source, sd_1, hd_1, ... }
            const streamUrl = data.hd_1 || data.sd_1 || data.hd_2 || data.sd_2 || data.source || data.stream_url || data.url;
            if (streamUrl) {
                console.log(`[gavang] Got direct stream URL from API: ${streamUrl}`);

                // Khôi phục các server names nếu cần chuyển server
                const availableServers = [];
                if (data.hd_1 || data.sd_1) availableServers.push("Server 1");
                if (data.hd_2 || data.sd_2) availableServers.push("Server 2");
                if (data.hd_3 || data.sd_3) availableServers.push("Server 3");

                // Xử lý chuyển server
                let finalUrl = streamUrl;
                if (requestedServer === "Server 1") finalUrl = data.hd_1 || data.sd_1 || finalUrl;
                if (requestedServer === "Server 2") finalUrl = data.hd_2 || data.sd_2 || finalUrl;
                if (requestedServer === "Server 3") finalUrl = data.hd_3 || data.sd_3 || finalUrl;

                return { streamUrl: finalUrl, iframeSrc: null, servers: availableServers };
            }
        } catch (e) {
            clearTimeout(t);
            console.log(`[gavang] Fetch API stream failed: ${e.message}`);
        }
    }

    // 2. Fallback về Playwright nếu người dùng truyền vào trang Gavang cũ (ví dụ bookmark)
    console.log('[gavang] Target URL is not API, using Playwright fallback:', targetUrl);
    return extractGavangStreamPlaywright(targetUrl, requestedServer);
}

// ── Browser Singleton (chỉ dùng cho stream extraction cũ, gần như không chạy) ─
let sharedBrowser = null;
async function getSharedBrowser() {
    if (sharedBrowser) {
        try { await sharedBrowser.version(); return sharedBrowser; } catch { sharedBrowser = null; }
    }
    sharedBrowser = await chromium.launch({ headless: true });
    return sharedBrowser;
}

// Keepalive: ping browser định kỳ để tránh bị OS kill
setInterval(async () => {
    if (sharedBrowser) {
        try { await sharedBrowser.version(); } catch { sharedBrowser = null; }
    }
}, 60 * 1000);

async function extractGavangStreamPlaywright(targetUrl, requestedServer = null) {
    let browser = null;
    let context = null;
    try {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        const page = await context.newPage();
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            const url = route.request().url();
            if (['image', 'font', 'stylesheet'].includes(type) || url.includes('guard_v1.js') || url.includes('google')) {
                return route.abort();
            }
            return route.continue();
        });

        let foundM3u8 = null;
        const captureUrl = (url) => {
            if (url.includes('.m3u8') || url.includes('.flv')) foundM3u8 = url;
        };
        page.on('request', req => captureUrl(req.url()));
        page.on('response', resp => captureUrl(resp.url()));

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS }).catch(() => { });
        try { await page.click('#player, .play-btn, .vjs-big-play-button', { timeout: 500 }); } catch { }

        const deadline = Date.now() + 10000;
        while (!foundM3u8 && Date.now() < deadline) { await page.waitForTimeout(100); }

        if (foundM3u8) {
            await context.close();
            return { streamUrl: foundM3u8, iframeSrc: targetUrl, servers: [] };
        }
        await context.close();
        return null;
    } catch (e) {
        console.error('[gavang] Error extracting stream:', e.message);
        if (context) await context.close().catch(() => { });
        return null;
    } finally {
        if (browser) await browser.close().catch(() => { });
    }
}

module.exports = {
    fetchGavangMatches,
    extractGavangStream,
    clearCache: () => {
        matchCache = { data: { matches: [], hasMore: false }, expiresAt: 0 };
    }
};

// Pre-warm cache
setTimeout(() => {
    console.log('[gavang] Pre-warming cache on startup...');
    fetchGavangMatches(false).catch(() => { });
}, 1000);
