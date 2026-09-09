/**
 * scraper_gavangtv.js — High Performance Scraper & Stream Extractor for Gà Vàng TV (gavang33.me).
 * Features: Background Polling, Non-blocking SWR Memory Cache, Instant Master Commentators.
 */

const BASE_API_URL = 'https://gavangtv-api.adviceme.io/api/v1';
const CACHE_TTL_MS = 25 * 1000; // 25s fresh cache
const BACKGROUND_POLL_INTERVAL_MS = 30 * 1000; // 30s background poller

let matchesCache = {
    data: [],
    timestamp: 0
};
let isFetchingInProgress = false;

const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://gavang33.me/',
    'Origin': 'https://gavang33.me',
};

// ── Master Static Fallback Commentators (Available 0ms Instant) ───────────────
const MASTER_GAVANG_COMMENTATORS = [
    { name: 'Gà Siêu Tốc', image: 'https://cdn.imgts.com/uploads/images/1778587966582-rk2hcgz996a.jpg' },
    { name: 'Gà Siêu Bệu', image: 'https://cdn.imgts.com/uploads/images/1778587936878-15cym0wmbia.jpg' },
    { name: 'Gà Siêu Gáy', image: 'https://cdn.imgts.com/uploads/images/1785246917752-jhzig7me0x.jpg' },
    { name: 'Gà Siêu Kiêu', image: 'https://cdn.imgts.com/uploads/images/1788173269358-6ashdooj408.png' },
    { name: 'Gà Siêu Péo', image: 'https://cdn.imgts.com/uploads/images/1786292918433-g0dd0wz1ef5.png' },
    { name: 'Gà Ô Long', image: 'https://cdn.imgts.com/uploads/images/1784649950061-r08eodd42l.png' },
    { name: 'Gà Siêu Son', image: 'https://cdn.imgts.com/uploads/images/1784649818862-gr6fqgbhsx8.png' },
    { name: 'Gà Chiến', image: '' },
    { name: 'Gà Chọi', image: '' },
    { name: 'Gà Con', image: '' },
];

function normalizeCommentator(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^blv\s*/i, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

/**
 * Format time and date from raw match.
 */
function formatMatchTimeDate(raw) {
    let time = '--:--';
    let date = '';

    if (raw.matchNormalizedDate && raw.matchNormalizedDate.includes(' ')) {
        const parts = raw.matchNormalizedDate.split(' ').map(s => s.trim());
        time = parts[0] || time;
        date = parts[1] || date;
    } else if (raw.matchTime && typeof raw.matchTime === 'number') {
        const d = new Date(raw.matchTime * 1000);
        time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
        date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    }

    return { time, date };
}

/**
 * Internal worker to refresh Gà Vàng TV data in background.
 */
async function _doFetchGavangMatches() {
    if (isFetchingInProgress) return;
    isFetchingInProgress = true;
    const now = Date.now();

    try {
        console.log(`[Gavang Worker] Background refreshing matches...`);
        const res = await fetch(`${BASE_API_URL}/matches?webType=gavang&t=${now}`, {
            headers: COMMON_HEADERS
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} when fetching Gà Vàng matches`);
        }

        const json = await res.json();
        const rawMap = json.data || {};
        const entries = Object.entries(rawMap);
        const matches = [];

        for (const [slugKey, raw] of entries) {
            const matchId = String(raw.matchId || raw.canonicalMatchId || slugKey);
            const { time, date } = formatMatchTimeDate(raw);

            const isLive = raw.matchStatus === 'live' || raw.matchStatus === 2;
            const isFinished = raw.matchStatus === 'finished' || raw.matchStatus === 3;
            const statusText = isLive ? 'Trực tiếp' : isFinished ? 'Đã kết thúc' : 'Sắp tới';

            let homeScore = (raw.homeScores && raw.homeScores.length > 0 && (isLive || isFinished)) ? raw.homeScores[0] : null;
            let awayScore = (raw.awayScores && raw.awayScores.length > 0 && (isLive || isFinished)) ? raw.awayScores[0] : null;

            // Stream servers & Commentators
            const anchors = raw.anchorAppointmentVoList || [];
            const servers = [];

            anchors.forEach((a, idx) => {
                const nick = a.nickName ? `${a.nickName}` : `BLV Gà ${idx + 1}`;
                const streamUrls = Array.isArray(a.streamUrls) ? a.streamUrls : [];
                const primaryHls = streamUrls.find(u => u.includes('.m3u8')) || streamUrls[0] || raw.defaultLink || '';
                const flvUrl = streamUrls.find(u => u.includes('.flv')) || '';

                if (primaryHls || flvUrl) {
                    servers.push({
                        id: `${a.id || idx}_srv`,
                        label: anchors.length > 1 ? `${nick} (Server ${idx + 1})` : `${nick} (Chính)`,
                        commentator: nick,
                        streamUrl: primaryHls,
                        flvUrl: flvUrl,
                        userImage: a.userImage || '',
                        commentatorId: a.id || matchId
                    });
                }
            });

            // Direct default stream if available
            if (raw.defaultLink && raw.defaultLink.startsWith('http')) {
                servers.push({
                    id: 'direct',
                    label: 'Đài Truyền Hình (Gốc)',
                    commentator: 'Trực tiếp',
                    streamUrl: raw.defaultLink,
                    flvUrl: '',
                    commentatorId: 'direct'
                });
            }

            const commentator = servers.length > 0 ? (servers[0].commentator || servers[0].label) : '';
            const isHot = Boolean(raw.pinHot || isLive || anchors.length > 0);
            const isSuperHot = Boolean(raw.pinHome || (isLive && anchors.length > 0));

            matches.push({
                id: `gavang_${matchId}`,
                matchId: matchId,
                slug: slugKey,
                sourceUrl: slugKey,
                home: raw.homeTeam?.name || 'Đội nhà',
                away: raw.awayTeam?.name || 'Đội khách',
                homeLogo: raw.homeTeam?.logo || '',
                awayLogo: raw.awayTeam?.logo || '',
                homeTeamId: raw.homeTeam?.id || '',
                awayTeamId: raw.awayTeam?.id || '',
                league: raw.competition?.name || 'Bóng Đá',
                leagueLogo: raw.competition?.logo || '',
                leagueId: raw.competition?.id || '',
                leagueShortName: raw.competition?.name || '',
                startTime: raw.matchTime || 0,
                time: time,
                date: date,
                status: isLive ? 'Trực tiếp' : isFinished ? 'Đã kết thúc' : 'Sắp tới',
                statusText: statusText,
                isLive: isLive,
                minute: isLive ? 'LIVE' : '',
                homeScore: homeScore,
                awayScore: awayScore,
                isHot: isHot,
                isSuperHot: isSuperHot,
                commentator: commentator,
                servers: servers,
                section: isLive ? 'live' : 'upcoming',
                source: 'gavangtv'
            });
        }

        if (matches.length > 0) {
            matchesCache = {
                data: matches,
                timestamp: now
            };
            console.log(`[Gavang Worker] ✓ Cache updated with ${matches.length} matches.`);
        }
    } catch (err) {
        console.warn(`[Gavang Worker] Background fetch error: ${err.message}`);
    } finally {
        isFetchingInProgress = false;
    }
}

/**
 * Fetch matches with Stale-While-Revalidate (Instant 0ms from RAM).
 * @param {boolean} forceRefresh 
 * @returns {Promise<Array>} Standardized match list
 */
async function fetchGavangMatches(forceRefresh = false) {
    const now = Date.now();
    const isStale = (now - matchesCache.timestamp) >= CACHE_TTL_MS;

    if (!forceRefresh && matchesCache.data.length > 0) {
        if (isStale) {
            _doFetchGavangMatches().catch(() => {});
        }
        return matchesCache.data;
    }

    await _doFetchGavangMatches();
    return matchesCache.data;
}

/**
 * Fetch and extract Gà Vàng TV commentators list with stats.
 * @returns {Promise<Array>} Commentator list
 */
async function fetchGavangCommentators() {
    const map = new Map();

    // 1. Pre-seed with master commentators
    MASTER_GAVANG_COMMENTATORS.forEach(c => {
        const norm = normalizeCommentator(c.name);
        map.set(norm, {
            id: `gavang_${norm}`,
            name: c.name,
            cleanName: c.name.replace(/^blv\s*/i, '').trim(),
            norm: norm,
            userImage: c.image || '',
            fansCount: 0,
            visitHistory: 0,
            matchCount: 0,
            source: 'gavangtv'
        });
    });

    // 2. Enrich from current cache
    if (matchesCache.data.length > 0) {
        matchesCache.data.forEach(m => {
            (m.servers || []).forEach(s => {
                if (s.commentator && s.id !== 'direct') {
                    const norm = normalizeCommentator(s.commentator);
                    if (!map.has(norm)) {
                        map.set(norm, {
                            id: `gavang_${norm}`,
                            name: s.commentator,
                            cleanName: s.commentator.replace(/^blv\s*/i, '').trim(),
                            norm: norm,
                            userImage: s.userImage || '',
                            fansCount: 0,
                            visitHistory: 0,
                            matchCount: 1,
                            source: 'gavangtv'
                        });
                    } else {
                        const item = map.get(norm);
                        item.matchCount += 1;
                        if (!item.userImage && s.userImage) item.userImage = s.userImage;
                    }
                }
            });
        });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => b.matchCount - a.matchCount);

    return list;
}

/**
 * Prewarm and start background polling worker.
 */
function prewarmGavangCache() {
    _doFetchGavangMatches().catch(() => {});
    setInterval(() => {
        _doFetchGavangMatches().catch(() => {});
    }, BACKGROUND_POLL_INTERVAL_MS);
}

/**
 * Extract live stream URLs and commentators for a specific Gà Vàng match.
 * @param {string} slug Slug or MatchId
 * @param {string} requestedServer Server or Commentator label
 * @returns {Promise<Object>} Stream info
 */
async function extractGavangStream(slug, requestedServer = '') {
    const cleanSlug = slug.replace(/^gavang_/, '');
    const matches = await fetchGavangMatches();
    let match = matches.find(m => m.slug === cleanSlug || m.matchId === cleanSlug || m.id === slug || m.slug === slug);

    let servers = match?.servers || [];

    // Fallback: If not found in memory cache or no servers, call the detail API directly
    if (!match || servers.length === 0) {
        try {
            console.log(`[Gavang Extract] Fetching direct detail API for: ${cleanSlug}`);
            const res = await fetch(`${BASE_API_URL}/matches/detail/${cleanSlug}`, {
                headers: COMMON_HEADERS
            });
            if (res.ok) {
                const json = await res.json();
                const raw = json.data;
                if (raw) {
                    const anchors = raw.anchorAppointmentVoList || [];
                    const detailServers = [];
                    anchors.forEach((a, idx) => {
                        const nick = a.nickName ? `${a.nickName}` : `BLV Gà ${idx + 1}`;
                        const streamUrls = Array.isArray(a.streamUrls) ? a.streamUrls : [];
                        const primaryHls = streamUrls.find(u => u.includes('.m3u8')) || streamUrls[0] || raw.defaultLink || '';
                        const flvUrl = streamUrls.find(u => u.includes('.flv')) || '';
                        if (primaryHls || flvUrl) {
                            detailServers.push({
                                id: `${a.id || idx}_srv`,
                                label: anchors.length > 1 ? `${nick} (Server ${idx + 1})` : `${nick} (Chính)`,
                                commentator: nick,
                                streamUrl: primaryHls,
                                flvUrl: flvUrl,
                                userImage: a.userImage || ''
                            });
                        }
                    });

                    if (raw.defaultLink && raw.defaultLink.startsWith('http')) {
                        detailServers.push({
                            id: 'direct',
                            label: 'Đài Truyền Hình (Gốc)',
                            commentator: 'Trực tiếp',
                            streamUrl: raw.defaultLink,
                            flvUrl: ''
                        });
                    }

                    if (detailServers.length > 0) {
                        servers = detailServers;
                        if (!match) {
                            match = {
                                home: raw.homeTeam?.name || 'Đội nhà',
                                away: raw.awayTeam?.name || 'Đội khách',
                                league: raw.competition?.name || 'Bóng Đá'
                            };
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[Gavang Extract] Detail API error: ${err.message}`);
        }
    }

    if (!match && servers.length === 0) {
        throw new Error(`Không tìm thấy luồng trực tiếp Gà Vàng: ${slug}`);
    }

    let selectedServer = servers[0];

    if (requestedServer) {
        const found = servers.find(s => 
            s.label === requestedServer || 
            s.commentator === requestedServer ||
            s.id === requestedServer
        );
        if (found) selectedServer = found;
    }

    return {
        success: true,
        streamUrl: selectedServer?.streamUrl || '',
        flvUrl: selectedServer?.flvUrl || '',
        servers: servers.map(s => s.label),
        selectedServer: selectedServer ? selectedServer.label : '',
        matchInfo: {
            home: match?.home || 'Đội nhà',
            away: match?.away || 'Đội khách',
            league: match?.league || 'Bóng Đá'
        },
        source: 'gavangtv'
    };
}

module.exports = {
    fetchGavangMatches,
    fetchGavangCommentators,
    extractGavangStream,
    normalizeCommentator,
    prewarmGavangCache
};
