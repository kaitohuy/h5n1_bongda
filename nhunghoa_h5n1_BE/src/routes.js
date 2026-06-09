/**
 * routes.js — Express route handlers for H5N1 scraper.
 * Source: timbageek.com / api-ls.cdnokvip.com
 */

const { Router } = require('express');
const https = require('https');
const http = require('http');
const { fetchMatches: fetchCdnokvipMatches, extractStream: extractCdnokvipStream } = require('./scraper_cdnokvip');
const { fetchMatches: fetchGavangtvMatches, extractStream: extractGavangtvStream } = require('./scraper_gavangtv_new');
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
    clearBongdaCache();
    res.json({ success: true, message: 'Cache cleared.' });
});

// ── Match listing ─────────────────────────────────────────────────────────────
// GET /api/matches?filter=live|hot|today|tomorrow|all&league={leagueId}&loadMore=true|false&source=timbageek|gavangtv
router.get('/api/matches', async (req, res) => {
    const { filter = 'all', league = '', loadMore = 'false', source = 'timbageek' } = req.query;
    const validFilters = ['live', 'hot', 'today', 'tomorrow', 'all'];
    const safeFilter = validFilters.includes(filter) ? filter : 'all';
    const isLoadMore = loadMore === 'true';

    console.log(`[matches] filter=${safeFilter} league=${league || 'all'} loadMore=${isLoadMore} preferredSource=${source}`);
    const start = Date.now();

    let matches = [];
    let activeSource = source === 'gavangtv' ? 'gavangtv' : 'timbageek';
    let allMatches = [];

    // Luồng tự động fallback nếu nguồn mặc định bị sập (dead)
    try {
        if (activeSource === 'timbageek') {
            try {
                allMatches = await fetchCdnokvipMatches();
            } catch (err) {
                console.warn(`[matches] Preferred source timbageek failed: ${err.message}. Falling back to gavangtv...`);
                allMatches = await fetchGavangtvMatches();
                activeSource = 'gavangtv';
            }
        } else {
            try {
                allMatches = await fetchGavangtvMatches();
            } catch (err) {
                console.warn(`[matches] Preferred source gavangtv failed: ${err.message}. Falling back to timbageek...`);
                allMatches = await fetchCdnokvipMatches();
                activeSource = 'timbageek';
            }
        }

        // Đảm bảo các thuộc tính matches được chuẩn hoá hoàn chỉnh
        allMatches = allMatches.map(m => ({
            ...m,
            statusText: m.status === 1 || m.isLive ? 'Trực tiếp'
                      : m.status === 3             ? 'Kết thúc'
                      : m.status === -1            ? 'Huỷ'
                      : 'Sắp diễn ra',
            sourceUrl: m.slug,
            source: activeSource, // thêm nguồn vào từng match để FE biết
        }));

        matches = allMatches;
        if (safeFilter === 'live') {
            matches = allMatches.filter(m => m.status === 1 || m.isLive);
        } else if (safeFilter === 'hot') {
            // timbageek lọc theo view >= 46000, gavangtv có thể dùng viewNumber hoặc m.pinHot
            matches = allMatches.filter(m => m.viewNumber >= 46000 || m.isHot);
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
            matches = matches.filter(m => m.league === league || m.leagueShortName === league);
        }

        const elapsed = Date.now() - start;
        console.log(`[matches] ✓ ${matches.length} matches in ${elapsed}ms (active source: ${activeSource})`);

        const leaguesMap = new Map();
        allMatches.forEach(m => {
            if (m.league && !leaguesMap.has(m.league)) {
                leaguesMap.set(m.league, { 
                    id: m.league, 
                    name: m.league, 
                    shortName: m.leagueShortName || '', 
                    logo: m.leagueLogo || '' 
                });
            }
        });
        const leagues = Array.from(leaguesMap.values());

        return res.json({ 
            success: true, 
            source: activeSource, 
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
// GET /api/extract?url={slug}&source={source}&server={serverLabel}
router.get('/api/extract', async (req, res) => {
    const { url, source, server = '' } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Missing url param' });

    // Normalize: lấy slug từ URL hoặc dùng thẳng
    let slug = url;
    try {
        const parsed = new URL(url);
        slug = parsed.pathname.split('/').filter(Boolean).pop() || url;
    } catch {
        // Không phải URL → đã là slug
    }

    // Tự động nhận diện nguồn dựa trên slug hoặc qua param
    // Gà Vàng TV slug thường kết thúc bằng gạch ngang và 15 ký tự chữ/số (ví dụ: -y0or5jh8w214qwz)
    const isGavangtvSlug = /-[a-z0-9]{15}$/i.test(slug);
    const useGavangtv = source === 'gavangtv' || (source !== 'timbageek' && isGavangtvSlug);
    const activeSource = useGavangtv ? 'gavangtv' : 'timbageek';

    console.log(`[extract] Extracting stream for slug: ${slug} (detected source: ${activeSource}, server: ${server})`);
    const start = Date.now();

    try {
        let result;
        if (activeSource === 'gavangtv') {
            // Đối với gavangtv, chuyển serverLabel sang index tương ứng nếu có
            let serverIndex = null;
            if (server) {
                // Fetch matches từ cache của gavangtv để xem danh sách servers
                try {
                    const matches = await fetchGavangtvMatches();
                    const match = matches.find(m => m.slug === slug);
                    if (match && match.servers) {
                        const idx = match.servers.findIndex(s => 
                            s.label === server || 
                            s.slug === server || 
                            s.commentator === server ||
                            String(s.commentatorId) === String(server)
                        );
                        if (idx !== -1) {
                            serverIndex = idx;
                            console.log(`[extract] Mapped server "${server}" to index ${serverIndex} for gavangtv`);
                        }
                    }
                } catch (e) {
                    console.error(`[extract] Failed to map server index for gavangtv:`, e.message);
                }
            }
            result = await extractGavangtvStream(slug, serverIndex);
        } else {
            result = await extractCdnokvipStream(slug, server);
        }

        if (!result || !result.streamUrl) {
            throw new Error('Không tìm thấy stream URL cho trận này');
        }

        const elapsed = Date.now() - start;
        console.log(`[extract] ✓ Found stream in ${elapsed}ms → ${result.streamUrl}`);
        return res.json({
            success: true,
            streamUrl: result.streamUrl,
            flvUrl: result.flvUrl || '',
            iframeSrc: result.iframeSrc || '',
            servers: result.servers || [],
            matchInfo: result.matchInfo || {},
            source: activeSource,
            elapsedMs: elapsed,
        });
    } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`[extract] ✗ Error after ${elapsed}ms: ${err.message}`);
        return res.status(500).json({
            success: false,
            error: `Lỗi: ${err.message}`,
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
        'fastestcdn-global.com', 'gv05',
        'cdnfaster', 'cdnokvip',
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
