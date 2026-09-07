/**
 * scraper_cakhiatv.js — High Performance Scraper module for CakhiaTV (cakhiazaa.tv).
 * Features: Background Polling, Non-blocking SWR Memory Cache, Instant Master Commentators.
 */

const cheerio = require('cheerio');

const BASE_URL = 'https://cakhiazaa.tv';
const CACHE_TTL_MS = 25 * 1000; // 25s fresh cache
const BACKGROUND_POLL_INTERVAL_MS = 30 * 1000; // 30s background poller

let matchesCache = {
    data: [],
    timestamp: 0
};
let isFetchingInProgress = false;

const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/html, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': `${BASE_URL}/`,
};

// ── Master Static Fallback Commentators (Available 0ms Instant) ───────────────
const MASTER_CAKHIA_COMMENTATORS = [
    'HIRO', 'TONI', 'JOHAN', 'ROY', 'RIO', 'BEE', 'BRADY', 'ZANE', 
    'XMEN', 'RAVEN', 'OLER', 'LOGAN', 'KEN', 'ASTRA', 'NEMO', 'POLO', 
    'SILVA', 'MAX', 'FILIP', 'TOM', 'NICK', 'JEAN', 'ALAN', 'FELIX'
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
 * Helper to parse match elements from Cheerio instance.
 */
function parseMatchesFromCheerio($, matches, seenIds) {
    $('[data-sport="football"]').each((_, el) => {
        const $el = $(el);
        const fid = $el.attr('data-fid') || '';
        const runtime = $el.attr('data-runtime') || '';
        const startTime = runtime ? parseInt(runtime, 10) : 0;
        const statusAttr = $el.attr('data-status') || '';

        // League
        const league = $el.find('.gmd-match-league .text-ellipsis').text().trim() || 'Bóng Đá';
        const leagueLogo = $el.find('.gmd-comp_logo').attr('src') || '';

        // Match time & date
        const timeDateStr = $el.find('.gmd-match-date span').text().trim(); // e.g. "19:00 - 06/09"
        let time = '';
        let date = '';
        if (timeDateStr.includes('-')) {
            const parts = timeDateStr.split('-').map(s => s.trim());
            time = parts[0];
            date = parts[1];
        } else {
            time = timeDateStr;
        }

        // Teams
        const home = $el.find('.gmd-home_team .team-name-group p').text().trim();
        const away = $el.find('.gmd-away_team .team-name-group p').text().trim();
        const homeLogo = $el.find('.team-logo-group-home-logo img').attr('src') || '';
        const awayLogo = $el.find('.team-logo-group-away-logo img').attr('src') || '';

        if (!home || !away) return;

        // Status & Live: statusAttr "2" (Hiệp 1) or "4" (Hiệp 2) or "3" (Đang diễn ra) or aria-label contains 'Đang'
        const statusText = $el.attr('aria-label') || '';
        const isLive = statusAttr === '2' || statusAttr === '4' || statusAttr === '3' || statusText.includes('Đang') || $el.find('.icon-haflt').length > 0;

        // Scores
        let homeScore = null;
        let awayScore = null;
        const scoreText = $el.find('.grid-match__goal').first().text().trim();
        if (scoreText && scoreText.includes('-')) {
            const sParts = scoreText.split('-').map(s => parseInt(s.trim(), 10));
            if (!isNaN(sParts[0])) homeScore = sParts[0];
            if (!isNaN(sParts[1])) awayScore = sParts[1];
        }

        // Commentator
        let commentator = '';
        const commEls = $el.find('.gmd-match-footer__streamer span, .d-flex.align-items-center.gap-1');
        commEls.each((_, c) => {
            const t = $(c).text().replace(/[+▸\d]/g, '').trim();
            if (t && !commentator) commentator = t;
        });

        // Detail Slug Link
        let sourceUrl = $el.find('a.redirectPopup').attr('href') || $el.find('a').first().attr('href') || '';
        if (sourceUrl && !sourceUrl.startsWith('http')) {
            sourceUrl = BASE_URL + sourceUrl;
        }

        const id = fid || sourceUrl.replace(/[^a-zA-Z0-9]/g, '_');
        if (seenIds.has(id)) return;
        seenIds.add(id);

        const isHot = isLive || Boolean(commentator);

        matches.push({
            id: `cakhia_${id}`,
            matchId: id,
            home,
            away,
            homeLogo,
            awayLogo,
            league,
            leagueLogo,
            time,
            date,
            startTime,
            status: isLive ? 'Trực tiếp' : 'Sắp tới',
            minute: isLive ? 'LIVE' : '',
            homeScore,
            awayScore,
            isHot,
            isSuperHot: isLive && Boolean(commentator),
            commentator: commentator ? `BLV ${commentator}` : '',
            section: isLive ? 'live' : 'upcoming',
            sourceUrl,
            source: 'cakhiatv'
        });
    });
}

/**
 * Internal worker to refresh CakhiaTV data in background.
 */
async function _doFetchCakhiaMatches() {
    if (isFetchingInProgress) return;
    isFetchingInProgress = true;
    const now = Date.now();

    try {
        console.log(`[Cakhia Worker] Background refreshing matches...`);
        const res = await fetch(`${BASE_URL}/sport/football/filter/all`, {
            headers: COMMON_HEADERS
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} when fetching CakhiaTV filter/all`);
        }

        const json = await res.json();
        const htmlChunks = Array.isArray(json.data?.htmls) ? json.data.htmls.join('') : Object.values(json.data?.htmls || {}).join('');
        const $ = cheerio.load(htmlChunks);
        const matches = [];
        const seenIds = new Set();

        parseMatchesFromCheerio($, matches, seenIds);

        if (matches.length === 0) {
            const homeRes = await fetch(BASE_URL, { headers: COMMON_HEADERS });
            if (homeRes.ok) {
                const homeHtml = await homeRes.text();
                const $home = cheerio.load(homeHtml);
                parseMatchesFromCheerio($home, matches, seenIds);
            }
        }

        if (matches.length > 0) {
            matchesCache = {
                data: matches,
                timestamp: now
            };
            console.log(`[Cakhia Worker] ✓ Cache updated with ${matches.length} matches.`);
        }
    } catch (err) {
        console.warn(`[Cakhia Worker] Background fetch error: ${err.message}`);
    } finally {
        isFetchingInProgress = false;
    }
}

/**
 * Fetch matches with Stale-While-Revalidate (Instant 0ms from RAM).
 * @param {boolean} forceRefresh 
 * @returns {Promise<Array>} Standardized match list
 */
async function fetchCakhiaMatches(forceRefresh = false) {
    const now = Date.now();
    const isStale = (now - matchesCache.timestamp) >= CACHE_TTL_MS;

    // If cache exists and fresh, return immediately
    if (!forceRefresh && matchesCache.data.length > 0) {
        if (isStale) {
            // Trigger non-blocking background revalidation
            _doFetchCakhiaMatches().catch(() => {});
        }
        return matchesCache.data;
    }

    // If no cache, perform immediate fetch
    await _doFetchCakhiaMatches();
    return matchesCache.data;
}

/**
 * Fetch and extract CakhiaTV commentators list (Instant 0ms).
 * @returns {Promise<Array>} Commentator list
 */
async function fetchCakhiaCommentators() {
    const map = new Map();

    // 1. Pre-seed with master commentators
    MASTER_CAKHIA_COMMENTATORS.forEach(cleanName => {
        const norm = normalizeCommentator(cleanName);
        map.set(norm, {
            id: `cakhia_${norm}`,
            name: `BLV ${cleanName}`,
            cleanName: cleanName,
            norm: norm,
            userImage: '',
            fansCount: 0,
            visitHistory: 0,
            matchCount: 0,
            source: 'cakhiatv'
        });
    });

    // 2. Enrich with match counts from current cache
    if (matchesCache.data.length > 0) {
        matchesCache.data.forEach(m => {
            if (m.commentator) {
                const cleanName = m.commentator.replace(/^blv\s*/i, '').trim();
                const norm = normalizeCommentator(cleanName);
                if (!norm) return;

                if (!map.has(norm)) {
                    map.set(norm, {
                        id: `cakhia_${norm}`,
                        name: `BLV ${cleanName}`,
                        cleanName: cleanName,
                        norm: norm,
                        userImage: '',
                        fansCount: 0,
                        visitHistory: 0,
                        matchCount: 1,
                        source: 'cakhiatv'
                    });
                } else {
                    const item = map.get(norm);
                    item.matchCount += 1;
                }
            }
        });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => b.matchCount - a.matchCount);

    return list;
}

/**
 * Prewarm and start background polling worker.
 */
function prewarmCakhiaCache() {
    _doFetchCakhiaMatches().catch(() => {});
    setInterval(() => {
        _doFetchCakhiaMatches().catch(() => {});
    }, BACKGROUND_POLL_INTERVAL_MS);
}

/**
 * Extract live stream URLs and commentators for a specific CakhiaTV match.
 * @param {string} detailUrl URL or slug of the match detail
 * @param {string} targetServerLabel Optional server/commentator label to resolve
 * @returns {Promise<Object>} Stream info and available servers
 */
async function extractCakhiaStream(detailUrl, targetServerLabel = '') {
    let fullUrl = detailUrl;
    if (!fullUrl.startsWith('http')) {
        fullUrl = `${BASE_URL}/truc-tiep/${detailUrl.replace(/^\//, '')}`;
    }

    console.log(`[Cakhia Extract] Fetching detail: ${fullUrl}`);
    const res = await fetch(fullUrl, {
        headers: COMMON_HEADERS
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} when fetching match detail`);
    }

    const html = await res.text();

    // 1. Extract list_stream
    const listStreamMatch = html.match(/var list_stream\s*=\s*(\[[\s\S]*?\]);/);
    if (!listStreamMatch) {
        throw new Error('Không tìm thấy luồng phát trực tiếp cho trận đấu này');
    }
    const listStream = JSON.parse(listStreamMatch[1]);

    // 2. Extract player-links (Commentators & Server labels)
    const $ = cheerio.load(html);
    const servers = [];

    $('.player-link').each((_, el) => {
        const $link = $(el);
        const linkIdx = parseInt($link.attr('data-link'), 10);
        let name = $link.text().replace(/\s+/g, ' ').trim();
        if (!name) name = `Server ${linkIdx + 1}`;

        let label = name;
        if (!label.toLowerCase().includes('blv') && !label.toLowerCase().includes('server')) {
            label = `BLV ${name}`;
        }

        const streamUrls = listStream[linkIdx] || [];
        if (streamUrls.length > 0) {
            servers.push({
                index: linkIdx,
                label,
                nodeUrls: streamUrls,
                embedUrl: streamUrls[0]
            });
        }
    });

    if (servers.length === 0 && listStream.length > 0) {
        listStream.forEach((urls, idx) => {
            if (urls && urls.length > 0) {
                servers.push({
                    index: idx,
                    label: `Server ${idx + 1}`,
                    nodeUrls: urls,
                    embedUrl: urls[0]
                });
            }
        });
    }

    // 3. Resolve direct stream URL for chosen server (or first server)
    const selectedServer = (targetServerLabel && servers.find(s => s.label === targetServerLabel)) || servers[0];
    let directStreamUrl = '';
    let flvUrl = '';

    if (selectedServer && selectedServer.embedUrl) {
        let nodeUrl = selectedServer.embedUrl;
        if (!nodeUrl.includes('/off-tvc')) {
            nodeUrl += '/off-tvc';
        }
        if (!nodeUrl.includes('is_off_add')) {
            nodeUrl += (nodeUrl.includes('?') ? '&' : '?') + 'is_off_add=false';
        }

        try {
            console.log(`[Cakhia Extract] Resolving stream from node: ${nodeUrl}`);
            const nodeRes = await fetch(nodeUrl, {
                headers: {
                    ...COMMON_HEADERS,
                    'Referer': `${BASE_URL}/`,
                }
            });

            if (nodeRes.ok) {
                const nodeHtml = await nodeRes.text();
                const urlStreamMatch = nodeHtml.match(/var\s+urlStream\s*=\s*["']([^"']+)["']/);
                if (urlStreamMatch) {
                    directStreamUrl = urlStreamMatch[1];
                    if (directStreamUrl.includes('.flv')) {
                        flvUrl = directStreamUrl;
                    }
                }
            }
        } catch (nodeErr) {
            console.warn(`[Cakhia Extract] Failed to resolve node stream: ${nodeErr.message}`);
        }
    }

    const finalStreamUrl = directStreamUrl || (selectedServer ? selectedServer.embedUrl : '');

    return {
        streamUrl: finalStreamUrl,
        flvUrl,
        servers: servers.map(s => s.label),
        selectedServer: selectedServer ? selectedServer.label : '',
        source: 'cakhiatv'
    };
}

module.exports = {
    fetchCakhiaMatches,
    fetchCakhiaCommentators,
    extractCakhiaStream,
    normalizeCommentator,
    prewarmCakhiaCache
};

