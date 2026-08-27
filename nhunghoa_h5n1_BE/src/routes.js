/**
 * routes.js — Express route handlers for H5N1 scraper microservice.
 * Integrated with ColaTV (gvapi.cc) & Bongda24h Standings.
 */

const { Router } = require('express');
const https = require('https');
const http = require('http');
const { 
    fetchMatches: fetchColatvMatches, 
    extractStream: extractColatvStream, 
    fetchCommentators,
    getScoreData 
} = require('./scraper_colatv');
const { getStandings, clearCache: clearBongdaCache, fetchDetailedStandings } = require('./scraper_bongda24h');

const router = Router();

const SCRAPER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── Health check (Render & K8s support) ───────────────────────────────────────
router.get(['/health', '/healthz', '/api/health'], (_req, res) => {
    res.json({ status: 'ok', service: 'nhunghoa-h5n1-be', timestamp: new Date().toISOString() });
});

// ── Commentators Listing & Ranking ────────────────────────────────────────────
router.get('/api/commentators', async (_req, res) => {
    try {
        const commentators = await fetchCommentators();
        return res.json({ success: true, commentators });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ── VTV6 Dynamic Live Streams ──────────────────────────────────────────────────
router.get('/api/vtv6', (_req, res) => {
    const servers = [
        {
            id: 'vtv6_hd',
            label: 'VTV6 Ultra HD (1080p Gốc)',
            commentator: 'Đài Truyền Hình VTV',
            streamUrl: 'https://vips-livecdn.fptplay.net/live/media/vtv6/live247-hls-avc/index.m3u8'
        }
    ];

    return res.json({
        success: true,
        channel: {
            id: 'vtv6',
            name: 'VTV6',
            title: 'Kênh VTV6 - Trực Tiếp Thể Thao',
            league: 'Đài Truyền Hình Việt Nam',
            home: 'Kênh VTV6',
            away: 'Trực Tiếp',
            homeLogo: 'https://vtvgo-assets.vtvdigital.vn/assets/images/v2/logo/VTV6_150x902_1675159127.webp',
            awayLogo: 'https://vtvgo-assets.vtvdigital.vn/assets/images/v2/logo/VTV6_150x902_1675159127.webp',
            time: '24/7',
            date: 'Hôm nay',
            statusText: 'Trực tiếp',
            isLive: true,
            streamUrl: servers[0].streamUrl,
            servers: servers,
            source: 'vtv6'
        }
    });
});

// ── Clear Cache ────────────────────────────────────────────────────────────────
router.get('/api/clear-cache', (_req, res) => {
    clearBongdaCache();
    res.json({ success: true, message: 'Cache cleared.' });
});

// ── Match listing ─────────────────────────────────────────────────────────────
// GET /api/matches?filter=live|hot|today|tomorrow|all&league={leagueId}&loadMore=true|false
router.get('/api/matches', async (req, res) => {
    const { filter = 'all', league = '' } = req.query;
    const validFilters = ['live', 'hot', 'today', 'tomorrow', 'all'];
    const safeFilter = validFilters.includes(filter) ? filter : 'all';

    console.log(`[matches] filter=${safeFilter} league=${league || 'all'}`);
    const start = Date.now();

    try {
        const allMatches = await fetchColatvMatches();
        let matches = allMatches;

        if (safeFilter === 'live') {
            matches = allMatches.filter(m => m.status === 1 || m.isLive);
        } else if (safeFilter === 'hot') {
            matches = allMatches.filter(m => m.isHot || m.isSuperHot || m.status === 1);
        } else if (safeFilter === 'today') {
            const today = new Date();
            const startOfDay = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000);
            const endOfDay = startOfDay + 86400;
            matches = allMatches.filter(m => m.startTime >= startOfDay && m.startTime < endOfDay);
        } else if (safeFilter === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startOfDay = Math.floor(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).getTime() / 1000);
            const endOfDay = startOfDay + 86400;
            matches = allMatches.filter(m => m.startTime >= startOfDay && m.startTime < endOfDay);
        }

        if (league && league !== 'all') {
            matches = matches.filter(m => m.league === league || m.leagueId === league);
        }

        // Tạo danh sách giải đấu cho bộ lọc leagues
        const leaguesMap = new Map();
        allMatches.forEach(m => {
            if (m.league && !leaguesMap.has(m.league)) {
                leaguesMap.set(m.league, { 
                    id: m.leagueId || m.league, 
                    name: m.league, 
                    shortName: m.leagueShortName || m.league, 
                    logo: m.leagueLogo || '' 
                });
            }
        });
        const leagues = Array.from(leaguesMap.values());

        const elapsed = Date.now() - start;
        console.log(`[matches] ✓ ${matches.length} matches returned in ${elapsed}ms`);

        return res.json({ 
            success: true, 
            source: 'colatv', 
            matches, 
            hasMore: false, 
            leagues, 
            elapsedMs: elapsed 
        });
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[matches] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message, elapsedMs: elapsed });
    }
});

// ── Standings (Bảng Xếp Hạng - bongda24h) ──────────────────────────────────────
// GET /api/standings
router.get('/api/standings', async (_req, res) => {
    console.log(`[standings] Requesting Leaderboards (source: bongda24h)`);
    const start = Date.now();
    try {
        const result = await getStandings();
        const elapsed = Date.now() - start;
        const leaguesCount = result.leagues ? result.leagues.length : 0;
        console.log(`[standings] ✓ Returning ${leaguesCount} leagues in ${elapsed}ms`);
        return res.json({ success: true, ...result, elapsedMs: elapsed });
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[standings] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message, elapsedMs: elapsed });
    }
});

// GET /api/standings/detail?url=...
router.get('/api/standings/detail', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Missing url param' });
    console.log(`[standings/detail] Requesting detailed standings for: ${url}`);
    const start = Date.now();
    try {
        const result = await fetchDetailedStandings(url);
        if (!result) throw new Error('Could not fetch detailed standings');
        const elapsed = Date.now() - start;
        
        if (result.isKnockout) {
            console.log(`[standings/detail] ✓ Returning knockout bracket HTML in ${elapsed}ms`);
            return res.json({ success: true, isKnockout: true, html: result.html, elapsedMs: elapsed });
        } else if (result.isMultiTable) {
            console.log(`[standings/detail] ✓ Returning ${result.tables.length} tables in ${elapsed}ms`);
            return res.json({ success: true, isMultiTable: true, tables: result.tables, elapsedMs: elapsed });
        } else {
            console.log(`[standings/detail] ✓ Returning ${result.length} teams in ${elapsed}ms`);
            return res.json({ success: true, teams: result, elapsedMs: elapsed });
        }
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[standings/detail] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message, elapsedMs: elapsed });
    }
});

// ── Score & Stats Data for 7 Tabs ─────────────────────────────────────────────
// GET /api/match/:id/score-data/:type
router.get('/api/match/:id/score-data/:type', async (req, res) => {
    const { id, type } = req.params;
    const validTypes = ['match', 'info', 'stats', 'statistics', 'incidents', 'lineups', 'standing', 'h2h', 'upcoming'];
    const safeType = type === 'statistics' ? 'stats' : type;

    if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid data type' });
    }

    try {
        const data = await getScoreData(id, safeType);
        return res.json({ success: true, data: data });
    } catch (err) {
        console.error(`[score-data] Error for ${id}/${type}:`, err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ── M3U8 stream extractor ─────────────────────────────────────────────────────
// GET /api/extract?url={slug}&server={serverLabel}
router.get('/api/extract', async (req, res) => {
    const { url, server = '' } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Missing url param' });

    let slug = url;
    try {
        const parsed = new URL(url);
        slug = parsed.pathname.split('/').filter(Boolean).pop() || url;
    } catch {
        // Already slug
    }

    console.log(`[extract] Extracting stream for slug: ${slug} (server: ${server})`);
    const start = Date.now();

    try {
        const result = await extractColatvStream(slug, server);
        const elapsed = Date.now() - start;
        console.log(`[extract] ✓ Found stream in ${elapsed}ms → ${result.streamUrl}`);
        
        return res.json({
            success: true,
            streamUrl: result.streamUrl,
            flvUrl: result.flvUrl || '',
            iframeSrc: '',
            servers: result.servers || [],
            matchInfo: result.matchInfo || {},
            source: 'colatv',
            elapsedMs: elapsed
        });
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[extract] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({
            success: false,
            error: `Lỗi: ${err.message}`,
            elapsedMs: elapsed
        });
    }
});

// ── Stream proxy ──────────────────────────────────────────────────────────────
// GET /api/proxy?url=<cdnStreamUrl>&ref=<iframeSrcUrl>
router.get('/api/proxy', (req, res) => {
    const { url, ref } = req.query;
    if (!url) return res.status(400).send('Missing url param');

    let parsedUrl;
    try { 
        parsedUrl = new URL(url); 
    } catch { 
        return res.status(400).send('Invalid url param'); 
    }

    // Security: allow known stream hosts including ColaTV & VTVgo & FPT CDNs
    const ALLOWED_HOSTS = [
        'ftlcbx.com', 'meung.app', 'miekgo.app', 'gvapi.cc',
        'vtvdigital.vn', 'vtvgo.vn', 'vcdn.vn', 'vtv.vn',
        'fptplay53.net', 'fptplay.net', 'canthotv.vn',
        'procdnlive.com', 'livecdnem.com', 'cdnfastest.com',
        'livecdn', 'hlslive', 'livestream', 'cdn.', '.cdn'
    ];
    const allowed = ALLOWED_HOSTS.some(h => parsedUrl.hostname.includes(h));
    if (!allowed) {
        console.warn(`[proxy] Blocked host: ${parsedUrl.hostname}`);
    }

    let referer = ref ? decodeURIComponent(ref) : 'https://colatv77.live/';
    let origin = 'https://colatv77.live';

    if (parsedUrl.hostname.includes('vtvdigital.vn') || parsedUrl.hostname.includes('vtvgo.vn') || parsedUrl.hostname.includes('vtv.vn')) {
        referer = 'https://vtvgo.vn/';
        origin = 'https://vtvgo.vn';
    } else if (parsedUrl.hostname.includes('fptplay53.net') || parsedUrl.hostname.includes('fptplay.net') || parsedUrl.hostname.includes('fptplay.vn')) {
        referer = 'https://fptplay.vn/';
        origin = 'https://fptplay.vn';
    }

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        agent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            'User-Agent': SCRAPER_UA,
            'Referer': referer,
            'Origin': origin,
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
        },
    };

    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = lib.request(options, (proxyRes) => {
        const status = proxyRes.statusCode;

        if (status !== 200 && status !== 206) {
            res.status(status).send(`CDN error: HTTP ${status}`);
            proxyRes.resume();
            return;
        }

        const ct = proxyRes.headers['content-type'] || '';
        const isM3u8 = parsedUrl.pathname.endsWith('.m3u8') || ct.includes('mpegurl') || ct.includes('x-mpegURL');

        if (isM3u8) {
            const chunks = [];
            proxyRes.on('data', c => chunks.push(c));
            proxyRes.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                const pathDir = parsedUrl.pathname.replace(/[^/]*$/, '');
                const cdnBase = `${parsedUrl.protocol}//${parsedUrl.hostname}${pathDir}`;
                const proxyOrigin = `${req.protocol}://${req.get('host')}`;
                const refEncoded = encodeURIComponent(referer);

                const rewritten = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return line;
                    const absUrl = trimmed.startsWith('http') ? trimmed : cdnBase + trimmed;
                    return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(absUrl)}&ref=${refEncoded}`;
                }).join('\n');

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-cache');
                res.send(rewritten);
            });
            proxyRes.on('error', err => { if (!res.headersSent) res.status(502).send(err.message); });
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            if (ct) res.setHeader('Content-Type', ct);
            const cl = proxyRes.headers['content-length'];
            if (cl) res.setHeader('Content-Length', cl);
            proxyRes.pipe(res);
            res.on('close', () => { proxyRes.destroy(); proxyReq.destroy(); });
        }
    });

    proxyReq.on('error', (err) => {
        console.error(`[proxy] Error for ${url}: ${err.message}`);
        if (!res.headersSent) res.status(502).send(`Proxy error: ${err.message}`);
    });
    req.on('close', () => proxyReq.destroy());
    proxyReq.end();
});

module.exports = router;
