/**
 * scraper_gavangtv_new.js — Gà Vàng TV Scraper
 *
 * Endpoint chính:
 *   - GET https://gavangtv.gvapi.cc/api/v1/matches/  -> Trả về all matches kèm theo streamUrls của từng BLV luôn.
 */

const GAVANG_API = 'https://gavangtv.gvapi.cc/api/v1/matches/';
const DEFAULT_TIMEOUT_MS = 15000;

let matchCache = null;
let matchCacheTime = 0;
const MATCH_CACHE_TTL = 3 * 60 * 1000; // 3 phút

// ── Match Listing ─────────────────────────────────────────────────────────────
async function fetchMatches() {
    const now = Date.now();
    if (matchCache && (now - matchCacheTime) < MATCH_CACHE_TTL) {
        return matchCache;
    }

    console.log('[gavangtv_new] Fetching matches from API...');
    const t0 = Date.now();

    const res = await fetch(GAVANG_API, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`Match listing failed: ${res.status}`);

    const json = await res.json();
    const rawData = json?.data || {};

    const matches = Object.keys(rawData).map(key => {
        const m = rawData[key];
        
        // Trạng thái: 0=upcoming, 1=live, 3=finished
        let statusMapped = 0;
        if (m.matchStatus === 'live') {
            statusMapped = 1;
        } else if (m.matchStatus === 'finished') {
            statusMapped = 3;
        }

        // Servers (BLV) từ anchorAppointmentVoList
        const servers = (m.anchorAppointmentVoList || []).map((vo, i) => {
            // Lấy streamUrl đầu tiên (.m3u8), nếu không có lấy .flv
            const hls = (vo.streamUrls || []).find(url => url.endsWith('.m3u8')) || vo.streamUrls?.[0] || '';
            const flv = (vo.streamUrls || []).find(url => url.endsWith('.flv')) || '';
            return {
                id: i + 1,
                label: `Server ${i + 1} - ${vo.nickName || 'BLV'}`,
                slug: `${m.slug}::${i}`,
                commentator: vo.nickName,
                commentatorId: vo.id,
                hls,
                flv
            };
        });

        // Nếu không có BLV nào, cung cấp defaultLink nếu có
        if (servers.length === 0 && m.defaultLink) {
            servers.push({
                id: 1,
                label: 'Server 1 - Default',
                slug: `${m.slug}::default`,
                commentator: 'Default',
                commentatorId: 'default',
                hls: m.defaultLink,
                flv: ''
            });
        }

        return {
            id: m.matchId || m.canonicalMatchId || key,
            slug: m.slug,
            home: m.homeTeam?.name || 'Đội nhà',
            away: m.awayTeam?.name || 'Đội khách',
            homeLogo: m.homeTeam?.logo || '',
            awayLogo: m.awayTeam?.logo || '',
            homeScore: m.homeScores?.[0] ?? null,
            awayScore: m.awayScores?.[0] ?? null,
            status: statusMapped,
            isLive: m.matchStatus === 'live',
            startTime: m.matchTime, // unix timestamp
            league: m.competition?.name || 'Không rõ',
            leagueShortName: m.competition?.name || 'Không rõ',
            leagueLogo: m.competition?.logo || '',
            commentator: servers.map(s => s.commentator).filter(Boolean).join(', '),
            viewNumber: m.viewer || 0,
            servers: servers // Lưu servers để map stream sau này
        };
    });

    console.log(`[gavangtv_new] Got ${matches.length} matches in ${Date.now() - t0}ms`);
    matchCache = matches;
    matchCacheTime = now;
    return matches;
}

// ── Stream URL Extraction ─────────────────────────────────────────────────────
async function extractStream(slug, reqServerIndex = null) {
    console.log(`[gavangtv_new] Extracting stream for slug: ${slug}, reqServerIndex: ${reqServerIndex}`);
    const matches = await fetchMatches();
    
    // Tìm trận theo slug
    const match = matches.find(m => m.slug === slug);
    if (!match) throw new Error(`Match not found for slug: ${slug}`);

    const servers = match.servers || [];
    if (servers.length === 0) throw new Error('No stream servers available');

    // Chọn server dựa trên index yêu cầu
    let idx = 0;
    if (reqServerIndex !== null && !isNaN(Number(reqServerIndex))) {
        idx = Number(reqServerIndex);
        if (idx < 0 || idx >= servers.length) idx = 0;
    }

    const selectedServer = servers[idx];

    return {
        streamUrl: selectedServer.hls,
        flvUrl: selectedServer.flv,
        iframeSrc: null,
        servers: servers.map(s => ({
            id: s.id,
            label: s.label,
            slug: s.slug,
            commentatorId: s.commentatorId
        })),
        matchInfo: {
            home: match.home,
            away: match.away,
            homeLogo: match.homeLogo,
            awayLogo: match.awayLogo,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            league: match.league,
            status: match.status,
        },
    };
}

// ── Pre-warm cache ────────────────────────────────────────────────────────────
async function prewarmCache() {
    try {
        console.log('[gavangtv_new] Pre-warming cache on startup...');
        await fetchMatches();
    } catch (err) {
        console.error('[gavangtv_new] Pre-warm failed:', err.message);
    }
}

module.exports = { fetchMatches, extractStream, prewarmCache };
