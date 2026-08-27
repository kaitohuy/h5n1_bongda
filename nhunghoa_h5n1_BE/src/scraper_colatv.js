/**
 * scraper_colatv.js — ColaTV (gvapi.cc) Scraper & Adapter
 *
 * Endpoints:
 *   - GET https://api.gvapi.cc/api/matches
 *   - GET https://api.gvapi.cc/api/match/detail_live?t={timestamp}
 *   - GET https://api.gvapi.cc/api/match/{slug}
 */

const COLATV_API_BASE = 'https://api.gvapi.cc/api';
const DEFAULT_TIMEOUT_MS = 15000;

const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://colatv77.live/',
    'Origin': 'https://colatv77.live',
};

// ── Cache ─────────────────────────────────────────────────────────────────────
let matchCache = null;
let matchCacheTime = 0;
const MATCH_CACHE_TTL = 20 * 1000; // 20 giây

let liveDetailCache = null;
let liveDetailCacheTime = 0;
const LIVE_DETAIL_CACHE_TTL = 5 * 1000; // 5 giây

// ── Hot Scoring Engine ────────────────────────────────────────────────────────
const TOP_TIER_LEAGUES = [
    'ngoại hạng anh', 'premier league', 'cúp c1', 'champions league', 
    'la liga', 'serie a', 'bundesliga', 'ligue 1', 'europa league', 'cúp c2',
    'v-league', 'việt nam', 'aff cup', 'world cup', 'euro', 'asian cup',
    'fa cup', 'cúp fa', 'carabao cup', 'cúp liên đoàn anh'
];

function calculateHotScore(match) {
    let score = 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const matchTime = match.matchTime || match.match_time || 0;
    const diffHours = (matchTime - nowSec) / 3600;

    // 1. Ưu tiên hàng đầu: Trận ĐANG TRỰC TIẾP (Live) (+300 điểm)
    const isLive = match.matchStatus === 2 || match.match_status === 'live';
    if (isLive) {
        score += 300;
    }

    // 2. Điểm khoảng cách thời gian (nếu chưa đá)
    if (!isLive && matchTime > 0) {
        if (diffHours >= 0 && diffHours <= 1.5) {
            score += 150; // Sắp đá trong 90 phút tới
        } else if (diffHours > 1.5 && diffHours <= 4) {
            score += 100; // Đá tối nay (trong 4 tiếng)
        } else if (diffHours > 4 && diffHours <= 8) {
            score += 60; // Đá đêm nay
        } else if (diffHours > 8 && diffHours <= 24) {
            score += 30; // Đá ngày mai
        }
    }

    // 3. Điểm giải đấu lớn
    const leagueLower = String(match.competitionName || '').toLowerCase();
    if (TOP_TIER_LEAGUES.some(l => leagueLower.includes(l))) {
        score += 80;
    }

    // 4. Điểm cờ pin_hot từ ColaTV
    if (match.pin_hot) {
        score += 60;
    }

    // 5. Điểm BLV & lượt xem
    const anchors = match.anchorAppointmentVoList || [];
    score += anchors.length * 30;

    for (const a of anchors) {
        if (a.liveStatus === 2) score += 50; // BLV đang live
        if (a.visitHistory && a.visitHistory > 1000000) score += 20;
        if (a.fansCount && a.fansCount > 100) score += 15;
    }

    return score;
}

// ── Fetch Real-time Live Details ──────────────────────────────────────────────
async function fetchLiveDetails() {
    const now = Date.now();
    if (liveDetailCache && (now - liveDetailCacheTime) < LIVE_DETAIL_CACHE_TTL) {
        return liveDetailCache;
    }

    try {
        const res = await fetch(`${COLATV_API_BASE}/match/detail_live?t=${now}`, {
            headers: API_HEADERS,
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });
        if (!res.ok) return liveDetailCache || [];
        const json = await res.json();
        const results = json.results || [];
        liveDetailCache = results;
        liveDetailCacheTime = now;
        return results;
    } catch (e) {
        console.warn(`[colatv] detail_live fetch error: ${e.message}`);
        return liveDetailCache || [];
    }
}

// ── Format helpers ────────────────────────────────────────────────────────────
function formatTimeDate(unixSeconds) {
    if (!unixSeconds) return { time: '--:--', date: '' };
    const d = new Date(unixSeconds * 1000);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    return { time, date };
}

// ── Match Listing ─────────────────────────────────────────────────────────────
async function fetchMatches() {
    const now = Date.now();
    if (matchCache && (now - matchCacheTime) < MATCH_CACHE_TTL) {
        return matchCache;
    }

    console.log('[colatv] Fetching matches from gvapi.cc...');
    const t0 = Date.now();

    const [matchesRes, liveDetails] = await Promise.all([
        fetch(`${COLATV_API_BASE}/matches`, {
            headers: API_HEADERS,
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        }),
        fetchLiveDetails().catch(() => [])
    ]);

    if (!matchesRes.ok) {
        throw new Error(`ColaTV matches API error: ${matchesRes.status}`);
    }

    const matchesJson = await matchesRes.json();
    const rawData = matchesJson.data || {};
    const matchEntries = Object.entries(rawData);

    // Map live details by id for quick lookup
    const liveMap = new Map();
    liveDetails.forEach(item => {
        if (item.id) liveMap.set(item.id, item);
    });

    const parsedMatches = [];

    for (const [slug, raw] of matchEntries) {
        const matchId = String(raw.matchId || raw.match_id || slug);
        const { time, date } = formatTimeDate(raw.matchTime || raw.match_time);

        const isLive = raw.matchStatus === 2 || raw.match_status === 'live';
        const isFinished = raw.matchStatus === 3 || raw.match_status === 'finished';
        const statusText = isLive ? 'Trực tiếp' : isFinished ? 'Đã kết thúc' : 'Sắp tới';

        // Tỷ số: homeScore và awayScore là mảng [FT, HT, Red, Yellow, Corner, ...]
        let homeScore = (raw.homeScore && raw.homeScore.length > 0 && (isLive || isFinished)) ? raw.homeScore[0] : null;
        let awayScore = (raw.awayScore && raw.awayScore.length > 0 && (isLive || isFinished)) ? raw.awayScore[0] : null;

        // Bổ sung dữ liệu realtime từ detail_live nếu có
        const liveDetail = liveMap.get(matchId) || liveMap.get(raw.node_api_data?.match_id);
        if (liveDetail && liveDetail.score) {
            const sc = liveDetail.score;
            if (sc[2] && sc[2].length > 0) homeScore = sc[2][0];
            if (sc[3] && sc[3].length > 0) awayScore = sc[3][0];
        }

        // Danh sách BLV & Stream servers (Server 1, Server 2, CDNs)
        const anchors = raw.anchorAppointmentVoList || [];
        const servers = [];

        anchors.forEach((a, idx) => {
            const nick = a.nickName ? `${a.nickName}` : `BLV ${idx + 1}`;
            const cdnServers = Array.isArray(a.servers) ? a.servers : [];
            const primaryHls = a.playStreamAddress2 || a.playStreamAddress || cdnServers[0] || '';
            const backupHls = (cdnServers[0] && cdnServers[0] !== primaryHls) 
                ? cdnServers[0] 
                : (a.playStreamAddress && a.playStreamAddress !== primaryHls ? a.playStreamAddress : '');

            // Server 1 (Chính)
            if (primaryHls) {
                servers.push({
                    id: `${a.houseId || idx}_srv1`,
                    label: anchors.length > 1 ? `${nick} (Server 1)` : `${nick} - Server 1 (Chính)`,
                    commentator: nick,
                    streamUrl: primaryHls,
                    flvUrl: a.playStreamAddress || '',
                    userImage: a.userImage || '',
                    fansCount: a.fansCount || 0,
                    visitHistory: a.visitHistory || 0,
                    commentatorId: a.houseId || matchId
                });
            }

            // Server 2 (Dự phòng CDN)
            if (backupHls) {
                servers.push({
                    id: `${a.houseId || idx}_srv2`,
                    label: anchors.length > 1 ? `${nick} (Server 2)` : `${nick} - Server 2 (Dự Phòng)`,
                    commentator: nick,
                    streamUrl: backupHls,
                    flvUrl: a.playStreamAddress || '',
                    userImage: a.userImage || '',
                    fansCount: a.fansCount || 0,
                    visitHistory: a.visitHistory || 0,
                    commentatorId: a.houseId || matchId
                });
            }

            // Các server dự phòng khác nếu có
            cdnServers.slice(1).forEach((extraUrl, extraIdx) => {
                if (extraUrl && extraUrl !== primaryHls && extraUrl !== backupHls) {
                    servers.push({
                        id: `${a.houseId || idx}_srv${extraIdx + 3}`,
                        label: anchors.length > 1 ? `${nick} (Server ${extraIdx + 3})` : `${nick} - Server ${extraIdx + 3}`,
                        commentator: nick,
                        streamUrl: extraUrl,
                        flvUrl: '',
                        userImage: a.userImage || '',
                        fansCount: a.fansCount || 0,
                        visitHistory: a.visitHistory || 0,
                        commentatorId: a.houseId || matchId
                    });
                }
            });
        });

        // Server kênh phát trực tiếp gốc từ đài nếu có
        if (raw.videoUrl && raw.videoUrl.startsWith('http')) {
            servers.push({
                id: 'direct',
                label: 'Đài Truyền Hình (Gốc)',
                commentator: 'Trực tiếp',
                streamUrl: raw.videoUrl,
                flvUrl: '',
                commentatorId: 'direct'
            });
        }

        const hotScore = calculateHotScore(raw);
        const commentator = servers.length > 0 ? (servers[0].commentator || servers[0].label) : '';

        parsedMatches.push({
            id: matchId,
            matchId: matchId,
            slug: slug,
            sourceUrl: slug,
            home: raw.homeTeamName || raw.home_team?.name || 'Đội nhà',
            away: raw.awayTeamName || raw.away_team?.name || 'Đội khách',
            homeLogo: raw.homeTeamLogo || raw.home_team?.logo || '',
            awayLogo: raw.awayTeamLogo || raw.away_team?.logo || '',
            homeTeamId: raw.homeTeamId || raw.home_team?.id || '',
            awayTeamId: raw.awayTeamId || raw.away_team?.id || '',
            league: raw.competitionName || raw.competition?.name || 'Bóng Đá',
            leagueLogo: raw.competitionLogo || raw.competition?.logo || '',
            leagueId: raw.competitionId || raw.competition?.id || '',
            leagueShortName: raw.competitionName || '',
            startTime: raw.matchTime || raw.match_time || 0,
            time: time,
            date: date,
            status: isLive ? 1 : isFinished ? 3 : 0,
            statusText: statusText,
            isLive: isLive,
            minute: isLive ? (raw.node_api_data?.raw?.note || 'Trực tiếp') : '',
            homeScore: homeScore,
            awayScore: awayScore,
            rawScores: {
                home: raw.homeScore || [],
                away: raw.awayScore || []
            },
            hotScore: hotScore,
            isHot: hotScore >= 60,
            isSuperHot: false, // Sẽ được gán sau khi sắp xếp
            commentator: commentator,
            servers: servers,
            videoUrl: raw.videoUrl || '',
            animationUrl: raw.animationUrl || raw.animation_url || '',
            environment: raw.node_api_data?.environment || null,
            rawNodeData: raw.node_api_data || null,
            source: 'colatv'
        });
    }

    // Xác định Trận Siêu Hot (Spotlight): Trận có hotScore cao nhất trong các trận chưa kết thúc
    const activeMatches = parsedMatches.filter(m => m.status !== 3);
    if (activeMatches.length > 0) {
        activeMatches.sort((a, b) => b.hotScore - a.hotScore);
        activeMatches[0].isSuperHot = true;
        activeMatches[0].isHot = true;
    }

    matchCache = parsedMatches;
    matchCacheTime = now;

    console.log(`[colatv] ✓ Fetched ${parsedMatches.length} matches in ${Date.now() - t0}ms`);
    return parsedMatches;
}

// ── Stream Extraction ─────────────────────────────────────────────────────────
async function extractStream(slug, requestedServer = '') {
    const matches = await fetchMatches();
    
    // Tìm match theo slug hoặc matchId
    const match = matches.find(m => m.slug === slug || m.id === slug || m.matchId === slug);
    if (!match) {
        // Thử fetch trực tiếp chi tiết từ API nếu không có trong cache
        try {
            const res = await fetch(`${COLATV_API_BASE}/match/${slug}`, {
                headers: API_HEADERS,
                signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
            });
            if (res.ok) {
                const json = await res.json();
                if (json.match) {
                    const raw = json.match;
                    const anchors = raw.anchorAppointmentVoList || [];
                    const servers = anchors.map((a, idx) => ({
                        id: a.houseId || `anchor_${idx + 1}`,
                        label: a.nickName || `BLV Server ${idx + 1}`,
                        commentator: a.nickName || '',
                        streamUrl: a.playStreamAddress2 || a.playStreamAddress || (a.servers && a.servers[0]) || '',
                        flvUrl: a.playStreamAddress || '',
                        userImage: a.userImage || '',
                        commentatorId: a.houseId
                    }));

                    if (raw.video_url && raw.video_url.startsWith('http')) {
                        servers.push({
                            id: 'direct',
                            label: 'Đài Truyền Hình (Gốc)',
                            streamUrl: raw.video_url,
                            commentator: 'Trực tiếp'
                        });
                    }

                    const selected = servers[0] || {};
                    return {
                        success: true,
                        streamUrl: selected.streamUrl || raw.video_url || '',
                        flvUrl: selected.flvUrl || '',
                        servers: servers,
                        matchInfo: {
                            home: raw.home_team?.name || '',
                            away: raw.away_team?.name || '',
                            league: raw.competition?.name || ''
                        },
                        source: 'colatv'
                    };
                }
            }
        } catch (err) {
            console.warn(`[colatv] Direct slug fetch error: ${err.message}`);
        }

        throw new Error(`Không tìm thấy trận đấu: ${slug}`);
    }

    const servers = match.servers || [];
    let selectedServer = servers[0];

    if (requestedServer) {
        const found = servers.find(s => 
            s.label === requestedServer || 
            s.id === requestedServer || 
            s.commentator === requestedServer ||
            String(s.commentatorId) === String(requestedServer)
        );
        if (found) selectedServer = found;
    }

    const streamUrl = selectedServer?.streamUrl || match.videoUrl || '';

    return {
        success: true,
        streamUrl: streamUrl,
        flvUrl: selectedServer?.flvUrl || '',
        servers: servers,
        matchInfo: {
            home: match.home,
            away: match.away,
            league: match.league,
            homeLogo: match.homeLogo,
            awayLogo: match.awayLogo,
            statusText: match.statusText,
            time: match.time,
            date: match.date
        },
        source: 'colatv'
    };
}

// ── Score Data for 7 Tabs ─────────────────────────────────────────────────────
async function getScoreData(idOrSlug, type) {
    const matches = await fetchMatches();
    const match = matches.find(m => m.slug === idOrSlug || m.id === idOrSlug || m.matchId === idOrSlug);
    const liveDetails = await fetchLiveDetails();
    const liveItem = liveDetails.find(r => r.id === idOrSlug || (match && r.id === match.id));

    // Mapping stats type code sang label tiếng Việt
    const STATS_TYPE_MAP = {
        2: 'Tổng số cú sút',
        21: 'Sút trúng đích',
        22: 'Phạt góc',
        23: 'Tấn công',
        24: 'Tấn công nguy hiểm',
        25: 'Kiểm soát bóng (%)',
        8: 'Thẻ vàng',
        4: 'Thẻ đỏ',
        3: 'Phạm lỗi',
        37: 'Cứu thua'
    };

    if (type === 'match' || type === 'info') {
        return {
            code: 0,
            data: {
                id: match?.id || idOrSlug,
                home: match?.home || '',
                away: match?.away || '',
                homeLogo: match?.homeLogo || '',
                awayLogo: match?.awayLogo || '',
                league: match?.league || '',
                environment: match?.environment || {},
                time: match?.time || '',
                date: match?.date || '',
                venue: match?.rawNodeData?.raw?.venue_id || 'Đang cập nhật',
                referee: match?.rawNodeData?.raw?.referee_id || 'Đang cập nhật'
            }
        };
    }

    if (type === 'stats') {
        const rawStats = liveItem?.stats || [];
        const getStatVal = (t, side) => {
            const found = rawStats.find(s => s.type === t);
            return found ? (found[side] || 0) : 0;
        };

        const hs = match?.rawScores?.home || [];
        const as = match?.rawScores?.away || [];

        const homePossession = getStatVal(25, 'home') || (getStatVal(25, 'away') ? 100 - getStatVal(25, 'away') : (match?.isLive ? 50 : 0));
        const awayPossession = getStatVal(25, 'away') || (getStatVal(25, 'home') ? 100 - getStatVal(25, 'home') : (match?.isLive ? 50 : 0));

        const homeObj = {
            ball_possession: homePossession,
            shots: getStatVal(2, 'home'),
            shots_on_target: getStatVal(21, 'home'),
            corner_kicks: getStatVal(22, 'home') || hs[4] || 0,
            yellow_cards: getStatVal(8, 'home') || hs[3] || 0,
            red_cards: getStatVal(4, 'home') || hs[2] || 0,
            attacks: getStatVal(23, 'home'),
            dangerous_attack: getStatVal(24, 'home'),
            saves: getStatVal(37, 'home'),
            goals: hs[0] || 0
        };

        const awayObj = {
            ball_possession: awayPossession,
            shots: getStatVal(2, 'away'),
            shots_on_target: getStatVal(21, 'away'),
            corner_kicks: getStatVal(22, 'away') || as[4] || 0,
            yellow_cards: getStatVal(8, 'away') || as[3] || 0,
            red_cards: getStatVal(4, 'away') || as[2] || 0,
            attacks: getStatVal(23, 'away'),
            dangerous_attack: getStatVal(24, 'away'),
            saves: getStatVal(37, 'away'),
            goals: as[0] || 0
        };

        return {
            code: 0,
            data: [
                { type: 0, stats: [homeObj, awayObj] }, // all
                { type: 1, stats: [homeObj, awayObj] }  // half 1
            ]
        };
    }

    if (type === 'incidents') {
        const incidents = liveItem?.incidents || [];
        return {
            code: 0,
            data: incidents.map(inc => ({
                type: inc.type === 1 ? 'goal' : inc.type === 2 ? 'yellow_card' : inc.type === 3 ? 'red_card' : 'event',
                position: inc.position === 1 ? 'home' : 'away',
                time: inc.time,
                homeScore: inc.home_score,
                awayScore: inc.away_score,
                text: inc.type === 1 ? `VÀOOO! Tỷ số ${inc.home_score} - ${inc.away_score}` : 'Sự kiện trận đấu'
            }))
        };
    }

    if (type === 'lineups') {
        return {
            code: 0,
            data: {
                hasLineup: false,
                message: 'Đội hình ra sân sẽ được cập nhật trước giờ thi đấu 30-45 phút.'
            }
        };
    }

    if (type === 'standing' || type === 'h2h') {
        return {
            code: 0,
            data: {
                matches: [],
                message: 'Dữ liệu đối đầu đang được cập nhật.'
            }
        };
    }

    return { code: 0, data: {} };
}

// ── Commentator Priority & Listing ────────────────────────────────────────────
function normalizeCommentatorName(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
        .replace(/^blv\s*/i, '')         // Bỏ tiền tố "BLV"
        .replace(/[^a-z0-9]/g, '')       // Bỏ ký tự đặc biệt, khoảng trắng thừa
        .trim();
}

async function fetchCommentators() {
    const matches = await fetchMatches();
    const map = new Map();

    matches.forEach(m => {
        (m.servers || []).forEach(s => {
            if (s.commentator && s.id !== 'direct') {
                const norm = normalizeCommentatorName(s.commentator);
                if (!map.has(norm)) {
                    map.set(norm, {
                        id: norm,
                        name: s.commentator,
                        cleanName: s.commentator.replace(/^blv\s*/i, '').trim(),
                        norm: norm,
                        userImage: s.userImage || '',
                        fansCount: s.fansCount || 0,
                        visitHistory: s.visitHistory || 0,
                        matchCount: 1,
                        score: 0
                    });
                } else {
                    const existing = map.get(norm);
                    existing.matchCount += 1;
                    if (s.fansCount && s.fansCount > existing.fansCount) existing.fansCount = s.fansCount;
                    if (s.visitHistory && s.visitHistory > existing.visitHistory) existing.visitHistory = s.visitHistory;
                    if (!existing.userImage && s.userImage) existing.userImage = s.userImage;
                }
            }
        });
    });

    const list = Array.from(map.values()).map(c => {
        let score = (c.fansCount * 10) + Math.floor(c.visitHistory / 100000) + (c.matchCount * 20);
        
        // Bắt buộc: Ưu tiên BLV Già Làng làm Top 1 mặc định trên hệ thống
        if (c.norm === 'gialang' || c.norm.includes('gialang')) {
            score += 1000000;
        }

        return { ...c, score };
    });

    // Sắp xếp giảm dần theo điểm độ phổ biến
    list.sort((a, b) => b.score - a.score);

    return list;
}

function prewarmCache() {
    fetchMatches().catch(err => console.warn(`[colatv] Prewarm failed: ${err.message}`));
}

module.exports = {
    fetchMatches,
    fetchLiveDetails,
    fetchCommentators,
    normalizeCommentatorName,
    extractStream,
    getScoreData,
    prewarmCache
};

