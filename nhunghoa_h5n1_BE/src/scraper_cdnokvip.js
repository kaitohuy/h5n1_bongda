/**
 * scraper_cdnokvip.js — TimbageekTV / CDNokvip scraper
 *
 * Match listing : Direct REST API (api-ls.cdnokvip.com) — no browser needed (~100ms)
 * Stream URL    : /api/match-detail-slug?slug={slug} — direct, no Playwright needed!
 *
 * API structure:
 *   - GET /api/get-livestream-group?isHot=false&isLive=false&... → list matches
 *   - GET /api/match-detail-slug?slug={slugUrl}               → stream links + multi-server
 */

const CDNOKVIP_API = 'https://api-ls.cdnokvip.com/api';
const CDN_BASE     = 'https://timbageek.com';

const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': CDN_BASE,
    'Referer': CDN_BASE + '/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
};

const DEFAULT_TIMEOUT_MS = 15000;

// ── Cache ─────────────────────────────────────────────────────────────────────

let matchCache = null;
let matchCacheTime = 0;
const MATCH_CACHE_TTL = 3 * 60 * 1000; // 3 phút

// ── Match Listing ─────────────────────────────────────────────────────────────

async function fetchMatches() {
    const now = Date.now();
    if (matchCache && (now - matchCacheTime) < MATCH_CACHE_TTL) {
        return matchCache;
    }

    console.log('[cdnokvip] Fetching matches from API...');
    const t0 = Date.now();

    // Lấy tất cả trận (today + tomorrow + upcoming)
    const params = new URLSearchParams({
        isHot: 'false',
        isLive: 'false',
        isToday: 'false',
        isTomorrow: 'false',
        _t: String(now),
    });

    const res = await fetch(`${CDNOKVIP_API}/get-livestream-group?${params}`, {
        headers: API_HEADERS,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`Match listing failed: ${res.status}`);

    const json = await res.json();
    const raw = json?.value?.datas || [];

    // Chỉ lấy bóng đá (typeSport = 0)
    const matches = raw
        .filter(m => m.typeSport === 0)
        .map(m => ({
            id: m.matchId,
            slug: m.slugUrl,
            home: m.homeName,
            away: m.awayName,
            homeLogo: m.homeLogo || '',
            awayLogo: m.awayLogo || '',
            homeScore: m.homeScore ?? 0,
            awayScore: m.awayScore ?? 0,
            status: m.status,        // 0=upcoming, 1=live, 3=finished, -1=cancelled
            isLive: m.liveGame,
            startTime: m.matchTime,  // unix timestamp
            league: m.leagueName,
            leagueShortName: m.leagueShortName,
            leagueColor: m.leagueColor,
            commentator: m.commentator,
            commentatorAvatar: m.avatar,
            viewNumber: m.viewNumber || 0,
            // Mỗi trận có thể có nhiều BLV (servers)
            servers: (m.liveScoreRefs || []).map((ref, i) => ({
                label: `Server ${i + 1} - ${ref.commentator || ''}`,
                slug: ref.slugUrl,
                commentator: ref.commentator,
                commentatorId: ref.commentatorId,
            })),
        }));

    console.log(`[cdnokvip] Got ${matches.length} football matches in ${Date.now() - t0}ms`);
    matchCache = matches;
    matchCacheTime = now;
    return matches;
}

// ── Stream URL Extraction ─────────────────────────────────────────────────────

async function extractStream(slug, serverLabel = '') {
    console.log(`[cdnokvip] Fetching stream for slug: ${slug}, serverLabel: ${serverLabel}`);
    const t0 = Date.now();

    const res = await fetch(
        `${CDNOKVIP_API}/match-detail-slug?slug=${encodeURIComponent(slug)}`,
        {
            headers: API_HEADERS,
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        }
    );

    if (!res.ok) throw new Error(`match-detail-slug failed: ${res.status}`);

    const json = await res.json();
    const data = json?.value?.datas;

    if (!data) throw new Error('No match data returned');

    // Lấy danh sách servers (BLV) cho trận này
    const commentators = data.listCommentators || [];
    const availableServers = commentators.map((c, i) => ({
        id: i + 1,
        label: `Server ${i + 1} - ${c.commentator || ''}`,
        slug: c.slugUrl,
        commentatorId: c.commentatorId,
    }));

    let streamUrl = data.linkLive || null;
    let flvUrl   = data.linkLiveFlv || null;

    // Nếu có chọn server, ta tìm server đó để fetch stream link tương ứng
    if (serverLabel && availableServers.length > 0) {
        const foundServer = availableServers.find(s => 
            s.label === serverLabel || 
            s.slug === serverLabel || 
            (s.commentatorId && String(s.commentatorId) === String(serverLabel))
        );
        if (foundServer && foundServer.slug && foundServer.slug !== slug) {
            console.log(`[cdnokvip] User selected server: ${foundServer.label}. Fetching details for sub-slug: ${foundServer.slug}`);
            try {
                const subRes = await fetch(
                    `${CDNOKVIP_API}/match-detail-slug?slug=${encodeURIComponent(foundServer.slug)}`,
                    {
                        headers: API_HEADERS,
                        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
                    }
                );
                if (subRes.ok) {
                    const subJson = await subRes.ok ? await subRes.json() : null;
                    const subData = subJson?.value?.datas;
                    if (subData) {
                        streamUrl = subData.linkLive || streamUrl;
                        flvUrl = subData.linkLiveFlv || flvUrl;
                        console.log(`[cdnokvip] Switched to sub-server stream: ${streamUrl}`);
                    }
                }
            } catch (errSub) {
                console.error(`[cdnokvip] Failed to fetch sub-server stream:`, errSub.message);
            }
        }
    }

    console.log(`[cdnokvip] Stream fetched in ${Date.now() - t0}ms`);
    console.log(`[cdnokvip]   HLS: ${streamUrl}`);
    console.log(`[cdnokvip]   FLV: ${flvUrl}`);
    console.log(`[cdnokvip]   Servers: ${availableServers.length}`);

    return {
        streamUrl,
        flvUrl,
        iframeSrc: null,
        servers: availableServers,
        matchInfo: {
            home: data.homeName,
            away: data.awayName,
            homeLogo: data.homeLogo,
            awayLogo: data.awayLogo,
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            league: data.leagueName,
            status: data.status,
        },
    };
}

// ── Pre-warm cache ────────────────────────────────────────────────────────────

async function prewarmCache() {
    try {
        console.log('[cdnokvip] Pre-warming cache on startup...');
        await fetchMatches();
    } catch (err) {
        console.error('[cdnokvip] Pre-warm failed:', err.message);
    }
}

module.exports = { fetchMatches, extractStream, prewarmCache };
