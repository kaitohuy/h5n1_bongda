/**
 * routes.js — Express route handlers for XoiLac scraper.
 */

const { Router } = require('express');
const https = require('https');
const http = require('http');
const { fetchGavangMatches, extractGavangStream, clearCache: clearGavangCache } = require('./scraper_gavang');
const { getStandings, clearCache: clearBongdaCache, fetchDetailedStandings } = require('./scraper_bongda24h');

const router = Router();

const SCRAPER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── Health check ──────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'nhunghoa-h5n1-be', timestamp: new Date().toISOString() });
});

// ── Clear Cache ────────────────────────────────────────────────────────────────
router.get('/api/clear-cache', (_req, res) => {
    clearGavangCache();
    clearBongdaCache();
    res.json({ success: true, message: 'Cache cleared for Gavang and Bongda24h.' });
});

// ── Match listing ─────────────────────────────────────────────────────────────
// GET /api/matches?filter=live|hot|today|tomorrow|all&league={leagueId}&loadMore=true|false
router.get('/api/matches', async (req, res) => {
    const { filter = 'all', league = '', loadMore = 'false' } = req.query;
    const validFilters = ['live', 'hot', 'today', 'tomorrow', 'all'];
    const safeFilter = validFilters.includes(filter) ? filter : 'all';
    const isLoadMore = loadMore === 'true';

    console.log(`[matches] filter=${safeFilter} league=${league || 'all'} loadMore=${isLoadMore}`);
    const start = Date.now();

    try {
        let matches = [];

        const payload = await fetchGavangMatches(isLoadMore);
        const allMatches = payload.matches || [];
        matches = allMatches;
        if (safeFilter === 'live') {
            matches = allMatches.filter(m => m.status === 'Trực tiếp');
        } else if (safeFilter === 'hot') {
            matches = allMatches.filter(m => m.isHot);
        }
        if (league && league !== 'all') {
            matches = matches.filter(m => m.league === league);
        }

        const elapsed = Date.now() - start;
        console.log(`[matches] ✓ ${matches.length} matches in ${elapsed}ms (source: gavang)`);

        // Extract leagues manually since extractLeagues was in scraper.js
        const leaguesMap = new Map();
        matches.forEach(m => {
            if (m.league && !leaguesMap.has(m.league)) {
                leaguesMap.set(m.league, { id: m.league, name: m.league, logo: m.leagueLogo || '' });
            }
        });
        const leagues = Array.from(leaguesMap.values());

        // Pre-fetch live stream URLs in background (disabled to prevent Render OOM on Free tier)
        // const liveUrls = matches
        //     .filter(m => m.status === 'Trực tiếp' && m.sourceUrl)
        //     .map(m => m.sourceUrl);
        // prefetchLiveStreams(liveUrls);

        return res.json({ success: true, source: 'gavang', matches, hasMore: payload.hasMore || false, leagues, elapsedMs: elapsed });
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[matches] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message, elapsedMs: elapsed });
    }
});

// ── Standings (Bảng Xếp Hạng) ────────────────────────────────────────────────
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
        const teams = await fetchDetailedStandings(url);
        if (!teams) throw new Error('Could not fetch detailed standings');
        const elapsed = Date.now() - start;
        console.log(`[standings/detail] ✓ Returning ${teams.length} teams in ${elapsed}ms`);
        return res.json({ success: true, teams, elapsedMs: elapsed });
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[standings/detail] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message, elapsedMs: elapsed });
    }
});

// ── M3U8 stream extractor ─────────────────────────────────────────────────────
// GET /api/extract?url=https://fshcgroup.com/truc-tiep/...
router.get('/api/extract', async (req, res) => {
    const { url, server } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Missing url param' });
    try { new URL(url); } catch { return res.status(400).json({ success: false, error: 'Invalid URL' }); }

    console.log(`[extract] Extracting stream from → ${url} (source: gavang)`);
    const start = Date.now();

    try {
        let result = await extractGavangStream(url, server);

        if (!result) {
            throw new Error("Không thể trích xuất stream từ GavangTV");
        }

        const elapsed = Date.now() - start;
        console.log(`[extract] ✓ Found stream in ${elapsed}ms → ${result.streamUrl}`);
        return res.json({
            success: true,
            streamUrl: result.streamUrl,
            iframeSrc: result.iframeSrc || '',
            servers: result.servers || [],
            source: url,
            elapsedMs: elapsed,
        });
    } catch (err) {
        const elapsed = Date.now() - start;
        const isTimeout = err.message?.includes('timeout') || err.message?.includes('Timeout');
        console.error(`[extract] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(isTimeout ? 504 : 500).json({
            success: false,
            error: isTimeout ? 'Hết thời gian — không tìm thấy stream.' : `Lỗi: ${err.message}`,
            elapsedMs: elapsed,
        });
    }
});

// ── Stream proxy ──────────────────────────────────────────────────────────────
// GET /api/proxy?url=<cdnStreamUrl>&ref=<iframeSrcUrl>
router.get('/api/proxy', (req, res) => {
    const { url, ref } = req.query;
    if (!url) return res.status(400).send('Missing url param');

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return res.status(400).send('Invalid url param'); }

    // Security: only proxy known CDN hosts
    const ALLOWED_HOSTS = [
        'procdnlive.com', 'pro2cdnlive.com', 'livecdnem.com', '91p.',
        'golivenow', 'cdnfastest.com', 'global.cdn',
        'livecdn', 'hlslive', 'livestream',
        'cdn.', '.cdn', 'live.', '.live',
        'fshcgroup.com', 'xoilacz',
        'sportliveapiz.com',
        'fastestcdn-global.com', 'gv05'
    ];
    const allowed = ALLOWED_HOSTS.some(h => parsedUrl.hostname.includes(h));
    if (!allowed) return res.status(403).send(`Proxy: host not allowed — ${parsedUrl.hostname}`);

    let referer = ref ? decodeURIComponent(ref) : `${parsedUrl.protocol}//${parsedUrl.hostname}/`;
    let origin = (() => { try { return new URL(referer).origin; } catch { return referer; } })();

    // Many Xoilac CDNs strictly check for their own iframe domains as referer
    if (parsedUrl.hostname.includes('procdnlive.com')
        || parsedUrl.hostname.includes('pro2cdnlive.com')
        || parsedUrl.hostname.includes('golivenow')
        || parsedUrl.hostname.includes('cdnfastest.com')
        || parsedUrl.hostname.includes('livecdnem.com')) {
        referer = 'https://xlz.livecdnem.com/';
        origin = 'https://xlz.livecdnem.com';
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
        console.log(`[proxy] CDN → ${status} for ${parsedUrl.hostname}${parsedUrl.pathname}`);

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
