/**
 * scraper_tieulamtv.js — TieulamTV Scraper
 *
 * Endpoints:
 *   - POST https://api.tlap12062026.xyz/matches/graph  -> Trả về danh sách trận đấu
 *   - GET  https://api.tlap12062026.xyz/match/${matchId}/live -> Trả về luồng live trực tiếp (nếu có)
 */

const DEFAULT_TIMEOUT_MS = 15000;

let matchCache = null;
let matchCacheTime = 0;
const MATCH_CACHE_TTL = 3 * 60 * 1000; // 3 phút

const { getApiDomain } = require('./tieulam_config');

// ── Match Listing ─────────────────────────────────────────────────────────────
async function fetchMatches() {
    const now = Date.now();
    if (matchCache && (now - matchCacheTime) < MATCH_CACHE_TTL) {
        return matchCache;
    }

    console.log('[tieulamtv] Fetching matches from graph API...');
    const t0 = Date.now();

    try {
        const domain = await getApiDomain();
        const res = await fetch(`https://${domain}/matches/graph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                fields: [],
                queries: [],
                limit: 300,
                page: 1,
                order_asc: "start_date"
            }),
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!res.ok) throw new Error(`Match listing failed: ${res.status}`);

        const json = await res.json();
        const rawMatches = json?.data || [];

        // Gom nhóm các trận đấu trùng tên, trùng giờ (để gom các BLV/server khác nhau)
        const groups = {};
        for (const m of rawMatches) {
            if (!m.team_1 || !m.team_2) continue;

            const timeKey = new Date(m.start_date).getTime();
            if (isNaN(timeKey)) continue;

            // Key gom nhóm: team1_vs_team2_startTime
            const key = `${m.team_1.trim().toLowerCase()}_vs_${m.team_2.trim().toLowerCase()}_${timeKey}`;

            // Trạng thái: 0=upcoming, 1=live, 3=finished
            let statusMapped = 0;
            const startTimeUnix = Math.floor(timeKey / 1000);
            if (m.is_live) {
                statusMapped = 1;
            } else if (timeKey + 120 * 60 * 1000 < Date.now()) {
                statusMapped = 3;
            }

            if (!groups[key]) {
                groups[key] = {
                    id: m.id,
                    slug: m.id,
                    home: m.team_1.trim(),
                    away: m.team_2.trim(),
                    homeLogo: m.team_1_logo || '',
                    awayLogo: m.team_2_logo || '',
                    homeScore: m.team_1_score !== undefined && m.team_1_score !== null ? Number(m.team_1_score) : null,
                    awayScore: m.team_2_score !== undefined && m.team_2_score !== null ? Number(m.team_2_score) : null,
                    status: statusMapped,
                    isLive: !!m.is_live,
                    startTime: startTimeUnix,
                    league: m.league || 'Không rõ',
                    leagueShortName: m.league || 'Không rõ',
                    leagueLogo: '',
                    viewNumber: m.is_top ? 50000 : 0,
                    isHot: !!(m.is_hot || m.is_top),
                    servers: []
                };
            }

            // Cập nhật thông tin chi tiết hơn nếu trận đấu này đang live
            if (m.is_live) {
                groups[key].status = 1;
                groups[key].isLive = true;
            }
            if (m.team_1_score !== undefined && m.team_1_score !== null && groups[key].homeScore === null) {
                groups[key].homeScore = Number(m.team_1_score);
            }
            if (m.team_2_score !== undefined && m.team_2_score !== null && groups[key].awayScore === null) {
                groups[key].awayScore = Number(m.team_2_score);
            }
            if (m.is_hot || m.is_top) {
                groups[key].isHot = true;
            }

            // Thêm server phát
            const serverIndex = groups[key].servers.length + 1;
            groups[key].servers.push({
                id: serverIndex,
                label: `Server ${serverIndex} - ${m.blv || 'Mặc định'}`,
                slug: m.id,
                commentator: m.blv || 'Mặc định',
                commentatorId: m.id,
                hls: m.source_live || ''
            });
        }

        // Convert sang array và map chuỗi BLV hiển thị
        const matches = Object.values(groups).map(g => {
            g.commentator = g.servers
                .map(s => s.commentator)
                .filter(c => c && c !== 'Mặc định')
                .join(', ') || 'Mặc định';
            return g;
        });

        console.log(`[tieulamtv] Processed ${matches.length} matches (grouped from ${rawMatches.length} raw streams) in ${Date.now() - t0}ms`);
        matchCache = matches;
        matchCacheTime = now;
        return matches;

    } catch (err) {
        console.error('[tieulamtv] Fetch matches error:', err.message);
        throw err;
    }
}

// ── Stream URL Extraction ─────────────────────────────────────────────────────
async function extractStream(slug, reqServerIndex = null) {
    console.log(`[tieulamtv] Extracting stream for slug: ${slug}, reqServerIndex: ${reqServerIndex}`);
    const matches = await fetchMatches();

    // Tìm trận đấu bằng slug chính hoặc server slug (trong trường hợp slug là ID của server)
    let match = matches.find(m => m.slug === slug);
    if (!match) {
        match = matches.find(m => m.servers.some(s => s.slug === slug || s.commentatorId === slug));
    }

    if (!match) throw new Error(`Trận đấu không tồn tại hoặc đã kết thúc (slug: ${slug})`);

    const servers = match.servers || [];
    if (servers.length === 0) throw new Error('Không có server phát nào khả dụng');

    // Lấy server tương ứng
    let idx = 0;
    if (reqServerIndex !== null && !isNaN(Number(reqServerIndex))) {
        idx = Number(reqServerIndex);
        if (idx < 0 || idx >= servers.length) idx = 0;
    }

    const selectedServer = servers[idx];
    const matchId = selectedServer.commentatorId; // Match ID cụ thể của luồng phát này trên TieulamTV

    let streamUrl = selectedServer.hls || '';

    // Gọi API để lấy link live trực tiếp mới nhất
    try {
        console.log(`[tieulamtv] Querying live endpoint for match ID: ${matchId}`);
        const domain = await getApiDomain();
        const res = await fetch(`https://${domain}/match/${matchId}/live`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (res.ok) {
            const data = await res.json();
            const liveUrl = data?.hd_1 || data?.hd_2 || data?.hd_3 || data?.source;
            if (liveUrl && liveUrl.startsWith('http')) {
                streamUrl = liveUrl;
                console.log(`[tieulamtv] Found live stream URL from live API: ${streamUrl}`);
            }
        } else {
            console.log(`[tieulamtv] Live API status: ${res.status}, falling back to cache.`);
        }
    } catch (err) {
        console.warn(`[tieulamtv] Failed to call live API: ${err.message}. Using cache.`);
    }

    if (!streamUrl) {
        throw new Error('Trận đấu chưa phát sóng hoặc link stream bị lỗi');
    }

    return {
        streamUrl: streamUrl,
        flvUrl: '',
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
        console.log('[tieulamtv] Pre-warming cache on startup...');
        await fetchMatches();
    } catch (err) {
        console.error('[tieulamtv] Pre-warm failed:', err.message);
    }
}

module.exports = { fetchMatches, extractStream, prewarmCache };
