/**
 * scraper.js — XoiLac (fshcgroup.com) API-based scraper + Playwright stream extractor.
 *
 * Match listing: direct JSON API (no browser needed — fast!)
 * Stream extraction: Playwright to intercept .m3u8 network requests
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());

const DEFAULT_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS || '20000', 10);

const LAUNCH_OPTIONS = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--mute-audio',
        '--disable-extensions',
        '--no-zygote',
    ],
};

const CONTEXT_OPTIONS = {
    userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
};

// ─────────────────────────────────────────────────────────────────────────────
// XoiLac config
// ─────────────────────────────────────────────────────────────────────────────
const XOILAC_BASE = 'https://fshcgroup.com';
const XOILAC_HEADERS = {
    'User-Agent': CONTEXT_OPTIONS.userAgent,
    'Referer': 'https://fshcgroup.com/',
    'Origin': 'https://fshcgroup.com',
    'Accept': 'application/json, text/plain, */*',
};

// Logo base URL for teams and leagues
const LOGO_BASE = 'https://imgts.sportpulseapiz.com';

// status_id mapping (observed from API)
// 0=scheduled, 1=not started, 2=first half, 3=half time, 4=second half,
// 5=extra time, 6=penaltis, 7=ended, 8=ended, 9=ended, -1=TBD
function statusFromId(statusId) {
    if (statusId === 2) return { status: 'Trực tiếp', minute: 'Hiệp 1' };
    if (statusId === 3) return { status: 'Trực tiếp', minute: 'HT' };
    if (statusId === 4) return { status: 'Trực tiếp', minute: 'Hiệp 2' };
    if (statusId === 5) return { status: 'Trực tiếp', minute: 'Hiệp phụ' };
    if (statusId === 6) return { status: 'Trực tiếp', minute: 'Penalty' };
    if (statusId >= 7) return { status: 'Đã kết thúc', minute: 'FT' };
    // 0 or 1 = upcoming
    return { status: 'Sắp tới', minute: '' };
}

// Parse match title: "Home vs Away lúc HH:MM ngày DD/MM/YYYY"
function parseTitleTeams(title) {
    const m = title.match(/^(.+?)\s+vs\s+(.+?)\s+lúc\s+(\d{1,2}:\d{2})\s+ngày\s+(\d{2})\/(\d{2})/i);
    if (!m) return { home: '', away: '', time: '', date: '' };
    return { home: m[1].trim(), away: m[2].trim(), time: m[3], date: `${m[4]}/${m[5]}` };
}

// Build logo URL for a team or competition
function logoUrl(type, id) {
    // type: 'team' or 'competition'
    return `${LOGO_BASE}/football/${type}/${id}/image/small`;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory match cache
// ─────────────────────────────────────────────────────────────────────────────
const matchCache = new Map(); // key → { data, expiresAt }
const LIVE_CACHE_TTL = 60 * 1000; // 1 min  — live matches update frequently
const OTHER_CACHE_TTL = 5 * 60 * 1000; // 5 min

// ─────────────────────────────────────────────────────────────────────────────
// Fetch live matches from sportflowlivez API
// Returns normalised match array — with league/team names from lookup tables
// ─────────────────────────────────────────────────────────────────────────────
async function _fetchLiveMatchesFromAPI() {
    const text = await fetch(
        'https://data.sportflowlivez.com/v1/football/xoilacz/match/live',
        { headers: XOILAC_HEADERS, signal: AbortSignal.timeout(8000) }
    ).then(r => r.ok ? r.text() : '').catch(() => '');

    if (!text.startsWith('{') && !text.startsWith('[')) return [];

    const json = JSON.parse(text);

    // The live API returns top-level lookup tables alongside match data:
    // { matches: [...], competitions: [...], teams: [...], commentators: [...] }
    const rawMatches = json.matches || json.data || (Array.isArray(json) ? json : []);

    // Build competition lookup: id → { name, short_name }
    const compMap = new Map();
    for (const c of (json.competitions || [])) {
        if (c.id) compMap.set(c.id, c.name || c.short_name || 'Không rõ');
    }

    // Build team lookup: id → { name }
    const teamMap = new Map();
    for (const t of (json.teams || [])) {
        if (t.id) teamMap.set(t.id, t.name || '');
    }

    // Save competition names to module-level cache for schedule parser reuse
    for (const [id, name] of compMap) {
        _compNameCache.set(id, name);
    }

    return rawMatches
        .filter(m => m.sport_type === 0 || m.sport_type === undefined) // football only
        .map((m, i) => {
            // Use lookup tables for team names; fall back to title parsing
            const homeFromTable = teamMap.get(m.home_team_id) || '';
            const awayFromTable = teamMap.get(m.away_team_id) || '';
            const { home: homeFromTitle, away: awayFromTitle, time, date } = parseTitleTeams(m.title || '');

            const { status, minute } = statusFromId(m.status_id);
            const homeScore = Array.isArray(m.home_scores) ? m.home_scores[0] : null;
            const awayScore = Array.isArray(m.away_scores) ? m.away_scores[0] : null;
            const leagueName = compMap.get(m.competition_id) || '';

            return {
                id: m.id || String(i),
                home: homeFromTable || homeFromTitle || 'Đội nhà',
                away: awayFromTable || awayFromTitle || 'Đội khách',
                homeLogo: m.home_team_id ? logoUrl('team', m.home_team_id) : '',
                awayLogo: m.away_team_id ? logoUrl('team', m.away_team_id) : '',
                leagueId: m.competition_id || '',
                leagueLogo: m.competition_id ? logoUrl('competition', m.competition_id) : '',
                league: leagueName,
                time: time || '--:--',
                date: date || '',
                status,
                minute,
                homeScore: homeScore !== null ? homeScore : null,
                awayScore: awayScore !== null ? awayScore : null,
                isHot: Boolean(m.is_hot || m.is_top),
                sourceUrl: m.slug ? (m.slug.startsWith('http') ? m.slug : XOILAC_BASE + m.slug) : '',
            };
        });
}

// Module-level competition name cache (populated by live API, reused by schedule parser)
const _compNameCache = new Map(); // competitionId → displayName

// ─────────────────────────────────────────────────────────────────────────────
// Fetch schedule (today or tomorrow) from sportliveapiz API
// Returns normalised match array
// ─────────────────────────────────────────────────────────────────────────────
// Observed ^-delimited format per record (separated by "!!"):
// [0]=matchId [1]=unixTs [2]='' [3]=someId [4]=someId [5]=sportType
// [6]=homeTeamId [7]=homeName [8..14]=7 score fields [15]=''
// [16]=awayTeamId [17]=awayName [18..24]=7 score fields [25]=''
// [26]=compId [27]=num [28]=num [29]=compId [30]=compNameGeneric ...
async function _fetchScheduleFromAPI(dateStr) {
    let schedText = await fetch(
        `https://fb.sportliveapiz.com/football/match/schedule/${dateStr}`,
        { headers: XOILAC_HEADERS, signal: AbortSignal.timeout(10000) }
    ).then(r => r.ok ? r.text() : '').catch(() => '');

    // Unwrap JSON wrapper: { data: { matches: '...' } }
    if (schedText.startsWith('{')) {
        try {
            const j = JSON.parse(schedText);
            const inner = j.data?.matches || j.data || schedText;
            schedText = typeof inner === 'string' ? inner : schedText;
        } catch { /* use raw */ }
    }

    if (typeof schedText !== 'string' || !schedText.includes('^')) return [];

    const records = schedText.split('!!').filter(s => s.includes('^'));
    const matches = [];

    for (let i = 0; i < records.length; i++) {
        try {
            const p = records[i].split('^');
            if (p.length < 18) continue;

            const matchId = p[0];
            const timestamp = parseInt(p[1] || '0', 10);
            if (!timestamp) continue;

            const homeTeamId = p[6] || '';
            const homeName = p[7] || '';
            const awayTeamId = p[16] || '';
            const awayName = p[17] || '';

            if (!homeName || !awayName) continue;
            // Skip records where names look like ID hashes (all lowercase alphanum, 14+ chars, no spaces)
            const looksLikeId = s => s && s.length > 10 && /^[a-z0-9]+$/.test(s) && !s.includes(' ');
            if (looksLikeId(homeName) || looksLikeId(awayName)) continue;

            // Competition: first try fixed index [26/29], then cache lookup
            const compId1 = p[26] || '';
            const compId2 = p[29] || '';
            const compId = (compId1 && !isNaN(Number(compId1)) ? '' : compId1)
                || (compId2 && !isNaN(Number(compId2)) ? '' : compId2)
                || '';
            // Generic name at [30] is often just "League", prefer our competition cache
            const genericName = p[30] || '';
            const leagueName = (compId && _compNameCache.get(compId))
                || (genericName !== 'League' ? genericName : '')
                || 'Không rõ';

            const matchDate = new Date(timestamp * 1000);
            const hh = String(matchDate.getHours()).padStart(2, '0');
            const mm = String(matchDate.getMinutes()).padStart(2, '0');
            const dd = String(matchDate.getDate()).padStart(2, '0');
            const mo = String(matchDate.getMonth() + 1).padStart(2, '0');

            matches.push({
                id: `sched-${matchId}`,
                home: homeName,
                away: awayName,
                homeLogo: homeTeamId ? logoUrl('team', homeTeamId) : '',
                awayLogo: awayTeamId ? logoUrl('team', awayTeamId) : '',
                leagueId: compId,
                leagueLogo: compId ? logoUrl('competition', compId) : '',
                league: leagueName,
                time: `${hh}:${mm}`,
                date: `${dd}/${mo}`,
                status: 'Sắp tới',
                minute: '',
                homeScore: null,
                awayScore: null,
                isHot: false,
                sourceUrl: '',
            });
        } catch { /* skip malformed record */ }
    }
    console.log(`[schedule] ${dateStr}: parsed ${matches.length} matches`);
    return matches;
}


// ─────────────────────────────────────────────────────────────────────────────
// Public: fetch match list with filter
// filter: 'live' | 'hot' | 'today' | 'tomorrow' | 'all'
// leagueId: optional string to filter by leagueId
// ─────────────────────────────────────────────────────────────────────────────
async function fetchXoilaczMatches(filter = 'all', leagueId = '') {
    const cacheKey = `xoilacz-${filter}-${leagueId}`;
    const cached = matchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[matches] Cache hit for ${cacheKey} (${cached.data.length} matches)`);
        return cached.data;
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

    let matches = [];
    let ttl = OTHER_CACHE_TTL;

    if (filter === 'live') {
        const live = await _fetchLiveMatchesFromAPI();
        matches = live.filter(m => m.status === 'Trực tiếp');
        ttl = LIVE_CACHE_TTL;

    } else if (filter === 'hot') {
        const live = await _fetchLiveMatchesFromAPI();
        matches = live.filter(m => m.isHot);
        if (matches.length === 0) {
            // Fallback: top 10 live or upcoming
            matches = live.slice(0, 10);
        }
        ttl = LIVE_CACHE_TTL;

    } else if (filter === 'today') {
        const [live, sched] = await Promise.allSettled([
            _fetchLiveMatchesFromAPI(),
            _fetchScheduleFromAPI(todayStr),
        ]);
        const liveArr = live.status === 'fulfilled' ? live.value : [];
        const schedArr = sched.status === 'fulfilled' ? sched.value : [];
        // Merge: live matches take priority (they have scores/status)
        const liveIds = new Set(liveArr.map(m => m.id));
        matches = [...liveArr, ...schedArr.filter(m => !liveIds.has(m.id))];
        ttl = LIVE_CACHE_TTL;

    } else if (filter === 'tomorrow') {
        matches = await _fetchScheduleFromAPI(tomorrowStr);

    } else { // 'all'
        const [live, sched] = await Promise.allSettled([
            _fetchLiveMatchesFromAPI(),
            _fetchScheduleFromAPI(todayStr),
        ]);
        const liveArr = live.status === 'fulfilled' ? live.value : [];
        const schedArr = sched.status === 'fulfilled' ? sched.value : [];
        const liveIds = new Set(liveArr.map(m => m.id));
        matches = [...liveArr, ...schedArr.filter(m => !liveIds.has(m.id))];
        ttl = LIVE_CACHE_TTL;
    }

    // Apply league filter
    if (leagueId) {
        matches = matches.filter(m => m.leagueId === leagueId);
    }

    matchCache.set(cacheKey, { data: matches, expiresAt: Date.now() + ttl });
    console.log(`[matches] ${filter} (league=${leagueId || 'all'}): ${matches.length} matches`);
    return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Distinct leagues from match list (for filter dropdown)
// ─────────────────────────────────────────────────────────────────────────────
// Popular leagues in priority order (matches league name substrings)
const LEAGUE_PRIORITY = [
    'ngoại hạng anh', 'premier league',
    'la liga',
    'bundesliga',
    'serie a',
    'ligue 1',
    'champions league',
    'europa league', 'conference league',
    'v.league', 'vleague',
    'world cup',
    'euro',
    'copa del rey',
    'fa cup',
    'mls',
    'saudi', 'roshn',
];

function leaguePriority(name = '') {
    const lc = name.toLowerCase();
    for (let i = 0; i < LEAGUE_PRIORITY.length; i++) {
        if (lc.includes(LEAGUE_PRIORITY[i])) return i;
    }
    return LEAGUE_PRIORITY.length; // unknown = lowest priority
}

function extractLeagues(matches) {
    const seen = new Map(); // leagueId → { leagueId, league, leagueLogo, count }
    for (const m of matches) {
        if (!m.leagueId) continue;
        if (!seen.has(m.leagueId)) {
            seen.set(m.leagueId, { leagueId: m.leagueId, league: m.league || 'Không rõ', leagueLogo: m.leagueLogo, count: 0 });
        }
        seen.get(m.leagueId).count++;
    }
    return Array.from(seen.values()).sort((a, b) => {
        const pa = leaguePriority(a.league);
        const pb = leaguePriority(b.league);
        if (pa !== pb) return pa - pb;          // priority first
        return b.count - a.count;               // then by match count
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// Stream extraction — Playwright (unchanged from before, works for xoilacz)
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACT_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS || '30000', 10);
const STREAM_RE = /https?:\/\/[^\s"'\\?#]+\.(?:m3u8|flv)(?:[?#][^\s"'\\]*)?/gi;

const streamCache = new Map();
const streamInFlight = new Map();
const STREAM_CACHE_TTL_MS = 4 * 60 * 1000;

async function fetchIframeText(iframeSrc, referer, userAgent) {
    const resp = await fetch(iframeSrc, {
        headers: {
            'User-Agent': userAgent,
            'Referer': referer,
            'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
}

async function tryExtractFromIframe(src, referer) {
    try {
        const html = await fetchIframeText(src, referer, CONTEXT_OPTIONS.userAgent);
        const found = html.match(STREAM_RE);
        if (found?.length) {
            const m3u8 = found.find(u => u.includes('.m3u8'));
            return { streamUrl: m3u8 || found[0], iframeSrc: src };
        }
    } catch (err) {
        console.warn(`[extract] iframe fetch failed (${src}): ${err.message}`);
    }
    return null;
}

async function _doExtractM3u8(targetUrl, timeoutMs) {
    const isXoilac = targetUrl.includes('fshcgroup.com') || targetUrl.includes('xoilacz');
    let browser = null;
    try {
        browser = await chromium.launch(LAUNCH_OPTIONS);
        const context = await browser.newContext(CONTEXT_OPTIONS);
        const page = await context.newPage();

        if (isXoilac) {
            // Allow scripts + media so player can init and emit stream URL
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['font', 'stylesheet'].includes(type)) return route.abort();
                return route.continue();
            });
        } else {
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['image', 'media', 'font', 'stylesheet', 'other'].includes(type)) return route.abort();
                return route.continue();
            });
        }

        // Intercept early stream URLs
        let earlyStream = null;
        const captureEarly = (url) => {
            try {
                const parsed = new URL(url);
                if (parsed.pathname.endsWith('.m3u8') || parsed.pathname.endsWith('.flv')) {
                    earlyStream = url;
                }
            } catch {
                // Ignore invalid URLs
            }
        };
        page.on('request', (req) => captureEarly(req.url()));
        page.on('response', (res) => captureEarly(res.url()));

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

        if (isXoilac) {
            // Inject ad-blocker CSS
            await page.addStyleTag({
                content: `
                    [class*="ads"], [class*="ad-"], [id*="ads"], [id*="ad-"],
                    iframe[src*="bet"], iframe[src*="casino"], .popup, .modal,
                    [class*="overlay"] { display: none !important; }
                `
            }).catch(() => { });

            // Try to click the big play button
            try {
                await page.click('.vjs-big-play-button, #player, button.play, [aria-label*="play"]', { timeout: 3000 });
                console.log('[extract] Clicked play button on xoilac stream page');
            } catch { /* autoplay */ }

            // Wait up to 12s for stream URL
            const deadline = Date.now() + 12000;
            while (!earlyStream && Date.now() < deadline) {
                await page.waitForTimeout(500);
            }
        }

        if (earlyStream) {
            console.log(`[extract] Found early stream: ${earlyStream}`);
            return { streamUrl: earlyStream, iframeSrc: targetUrl };
        }

        // Fallback: look for iframes
        const iframeSrcs = await page.evaluate(() =>
            [...document.querySelectorAll('iframe[src]')].map(f => f.src).filter(Boolean)
        );
        console.log(`[extract] Found ${iframeSrcs.length} iframes on match page`);

        await browser.close();
        browser = null;

        if (iframeSrcs.length > 0) {
            const results = await Promise.all(iframeSrcs.map(src => tryExtractFromIframe(src, targetUrl)));
            const winner = results.find(r => r !== null);
            if (winner) {
                console.log(`[extract] Found stream in iframe: ${winner.streamUrl}`);
                return winner;
            }
        }

        // CDN alt server fallback
        const cdnIframe = iframeSrcs.find(s => s.includes('livecdnem') || s.includes('91p.'));
        if (cdnIframe) {
            const altSrcs = [1, 2, 3, 4, 5, 6, 7, 8]
                .map(type => cdnIframe.replace(/\/type\/\d+\//, `/type/${type}/`))
                .filter((s, i) => i === 0 || s !== cdnIframe);
            const altResults = await Promise.all(altSrcs.map(src => tryExtractFromIframe(src, targetUrl)));
            const winner = altResults.find(r => r !== null);
            if (winner) return winner;
        }

        throw new Error('No stream URL found');

    } finally {
        await browser?.close().catch(() => { });
    }
}

async function extractM3u8(targetUrl, timeoutMs = EXTRACT_TIMEOUT_MS) {
    const cached = streamCache.get(targetUrl);
    if (cached && cached.expiresAt > Date.now()) {
        const remaining = Math.round((cached.expiresAt - Date.now()) / 1000);
        console.log(`[extract] Cache hit for ${targetUrl} (${remaining}s remaining)`);
        return { streamUrl: cached.streamUrl, iframeSrc: cached.iframeSrc };
    }

    if (streamInFlight.has(targetUrl)) {
        console.log(`[extract] Awaiting in-flight extraction for ${targetUrl}`);
        return streamInFlight.get(targetUrl);
    }

    const promise = _doExtractM3u8(targetUrl, timeoutMs)
        .then(result => {
            streamCache.set(targetUrl, {
                streamUrl: result.streamUrl,
                iframeSrc: result.iframeSrc,
                expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
            });
            console.log(`[extract] Cached stream for ${targetUrl} (TTL ${STREAM_CACHE_TTL_MS / 1000}s)`);
            return result;
        })
        .finally(() => streamInFlight.delete(targetUrl));

    streamInFlight.set(targetUrl, promise);
    return promise;
}

const MAX_PREFETCH = 6;
const PREFETCH_CONCURRENCY = 2;

async function prefetchLiveStreams(sourceUrls) {
    if (!sourceUrls?.length) return;
    const pending = sourceUrls
        .filter(url => {
            const c = streamCache.get(url);
            if (c && c.expiresAt > Date.now()) return false;
            if (streamInFlight.has(url)) return false;
            return true;
        })
        .slice(0, MAX_PREFETCH);

    if (!pending.length) { console.log('[prefetch] All streams cached.'); return; }
    console.log(`[prefetch] Pre-fetching ${pending.length} streams (concurrency=${PREFETCH_CONCURRENCY})…`);

    (async () => {
        let ok = 0;
        for (let i = 0; i < pending.length; i += PREFETCH_CONCURRENCY) {
            const batch = pending.slice(i, i + PREFETCH_CONCURRENCY);
            const results = await Promise.allSettled(batch.map(url =>
                extractM3u8(url).catch(err => console.warn(`[prefetch] Failed ${url}: ${err.message}`))
            ));
            ok += results.filter(r => r.status === 'fulfilled').length;
        }
        console.log(`[prefetch] Done: ${ok}/${pending.length} streams pre-fetched.`);
    })();
}

module.exports = { extractM3u8, fetchXoilaczMatches, extractLeagues, prefetchLiveStreams };
