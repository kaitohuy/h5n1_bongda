/**
 * Cloudflare Worker - H5N1 Bóng Đá Stream Proxy
 * Proxy m3u8/HLS streams từ GavangTV CDN, bypass CORS và 403 Forbidden.
 *
 * Improvements vs v1:
 *  - Cache .ts segments 10s ở CF edge (immutable, giảm latency lặp lại)
 *  - Cache .m3u8 playlist 2s (live playlist, update ~2-4s/lần)
 *  - Dùng CF Cache API thay vì fetch trực tiếp mỗi lần
 *  - Stream response body thay vì buffer (giảm TTFB cho segment lớn)
 *  - Hỗ trợ HEAD request (HLS player thường gửi HEAD trước GET)
 *  - Timeout 15s để tránh CF Worker bị treo
 */

const SCRAPER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Cache TTL theo loại file
const CACHE_TTL = {
    m3u8: 2,   // 2s — live playlist thay đổi liên tục
    ts: 10,    // 10s — video segment immutable
    other: 5,  // 5s — fallback
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');
        const ref = url.searchParams.get('ref');

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Max-Age': '86400',
                }
            });
        }

        if (!targetUrl) return new Response('Missing url parameter', { status: 400 });

        let parsedTarget;
        try {
            parsedTarget = new URL(targetUrl);
        } catch {
            return new Response('Invalid target URL', { status: 400 });
        }

        // Tính Referer và Origin từ param hoặc suy luận từ target URL
        const referer = ref ? decodeURIComponent(ref) : `${parsedTarget.protocol}//${parsedTarget.hostname}/`;
        let origin;
        try { origin = new URL(referer).origin; } catch { origin = referer; }

        // Xác định loại file để chọn cache TTL
        const pathname = parsedTarget.pathname.toLowerCase();
        const isM3u8 = pathname.endsWith('.m3u8');
        const isTs = pathname.endsWith('.ts') || pathname.endsWith('.aac') || pathname.endsWith('.m4s');
        const cacheTtl = isM3u8 ? CACHE_TTL.m3u8 : isTs ? CACHE_TTL.ts : CACHE_TTL.other;

        // ── CF Cache API ─────────────────────────────────────────────────────────
        // Chỉ cache GET requests (không cache HEAD hay POST)
        const cache = caches.default;
        const cacheKey = new Request(request.url, { method: 'GET' });

        if (request.method === 'GET') {
            const cached = await cache.match(cacheKey);
            if (cached) {
                // Cache hit — clone và thêm header debug
                const cachedRes = new Response(cached.body, cached);
                cachedRes.headers.set('X-Cache', 'HIT');
                cachedRes.headers.set('Access-Control-Allow-Origin', '*');
                // Trả HEAD response nếu client gửi HEAD
                return cachedRes;
            }
        }

        // ── Fetch từ CDN gốc ─────────────────────────────────────────────────────
        const fetchHeaders = new Headers();
        fetchHeaders.set('User-Agent', SCRAPER_UA);
        fetchHeaders.set('Referer', referer);
        fetchHeaders.set('Origin', origin);
        fetchHeaders.set('Accept', '*/*');
        fetchHeaders.set('Accept-Encoding', 'identity');

        try {
            // Timeout 15s để tránh Worker bị treo quá lâu
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(targetUrl, {
                method: request.method === 'HEAD' ? 'HEAD' : 'GET',
                headers: fetchHeaders,
                redirect: 'follow',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // Detect content type
            const contentType = response.headers.get('content-type') || '';
            const isM3u8ByContent = isM3u8 || contentType.includes('mpegurl') || contentType.includes('x-mpegURL');

            // Build response headers
            const resHeaders = new Headers(response.headers);
            resHeaders.set('Access-Control-Allow-Origin', '*');
            resHeaders.set('Access-Control-Expose-Headers', '*');
            resHeaders.set('Cache-Control', `public, max-age=${cacheTtl}, stale-while-revalidate=${cacheTtl * 2}`);
            resHeaders.set('X-Cache', 'MISS');
            resHeaders.delete('X-Frame-Options');
            resHeaders.delete('Content-Security-Policy');

            // ── M3U8: rewrite URLs trong playlist ──────────────────────────────────
            if (isM3u8ByContent && response.status === 200 && request.method !== 'HEAD') {
                const text = await response.text();
                const pathDir = parsedTarget.pathname.replace(/[^/]*$/, '');
                const cdnBase = `${parsedTarget.protocol}//${parsedTarget.hostname}${pathDir}`;
                const cfWorkerOrigin = `${url.protocol}//${url.host}`;
                const refEncoded = encodeURIComponent(referer);

                const rewrittenText = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return line;
                    // Resolve relative URL → absolute → wrap qua CF proxy
                    const absUrl = trimmed.startsWith('http') ? trimmed : cdnBase + trimmed;
                    return `${cfWorkerOrigin}/?url=${encodeURIComponent(absUrl)}&ref=${refEncoded}`;
                }).join('\n');

                resHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
                resHeaders.set('Content-Length', String(new TextEncoder().encode(rewrittenText).length));

                const finalRes = new Response(rewrittenText, { status: 200, headers: resHeaders });

                // Cache m3u8 result (ngắn hạn)
                ctx.waitUntil(cache.put(cacheKey, finalRes.clone()));
                return finalRes;
            }

            // ── Non-m3u8 (TS segments, etc.): stream thẳng về client ───────────────
            // Dùng response.body stream thay vì buffer toàn bộ → giảm TTFB
            const finalRes = new Response(
                request.method === 'HEAD' ? null : response.body,
                { status: response.status, headers: resHeaders }
            );

            // Cache TS segments bất đồng bộ (không block response)
            if (request.method === 'GET' && response.status === 200) {
                ctx.waitUntil(cache.put(cacheKey, finalRes.clone()));
            }

            return finalRes;

        } catch (e) {
            const isTimeout = e.name === 'AbortError';
            return new Response(
                isTimeout ? 'Proxy timeout (15s)' : `Proxy Error: ${e.message}`,
                {
                    status: isTimeout ? 504 : 502,
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            );
        }
    }
};
