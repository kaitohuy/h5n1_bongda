/**
 * Cloudflare Worker - H5N1 Bóng Đá Stream Proxy
 * Proxy m3u8/HLS streams từ CDN, bypass CORS và 403 Forbidden.
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

        try {
            const url = new URL(request.url);
            const targetUrl = url.searchParams.get('url');
            const ref = url.searchParams.get('ref');

            if (!targetUrl) {
                return new Response('Missing url parameter', { 
                    status: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' }
                });
            }

            let parsedTarget;
            try {
                parsedTarget = new URL(targetUrl);
            } catch {
                return new Response('Invalid target URL', { 
                    status: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Tính Referer và Origin từ param hoặc suy luận từ target URL
            let referer = ref ? decodeURIComponent(ref) : `${parsedTarget.protocol}//${parsedTarget.hostname}/`;
            let origin = `${parsedTarget.protocol}//${parsedTarget.hostname}`;

            // Bắt buộc ép Origin và Referer cho các CDN để tránh lỗi 403 Forbidden
            if (parsedTarget.hostname.includes('ftlcbx.com') || 
                parsedTarget.hostname.includes('meung.app') ||
                parsedTarget.hostname.includes('miekgo.app')) {
                origin = 'https://colatv77.live';
                referer = 'https://colatv77.live/';
            } else if (parsedTarget.hostname.includes('vtvdigital.vn') || 
                       parsedTarget.hostname.includes('vtvgo.vn') ||
                       parsedTarget.hostname.includes('vtv.vn')) {
                origin = 'https://vtvgo.vn';
                referer = 'https://vtvgo.vn/';
            } else if (parsedTarget.hostname.includes('fptplay53.net') ||
                       parsedTarget.hostname.includes('fptplay.net') ||
                       parsedTarget.hostname.includes('fptplay.vn')) {
                origin = 'https://fptplay.vn';
                referer = 'https://fptplay.vn/';
            }

            // Xác định loại file để chọn cache TTL
            const pathname = parsedTarget.pathname.toLowerCase();
            const isM3u8 = pathname.endsWith('.m3u8');
            const isTs = pathname.endsWith('.ts') || pathname.endsWith('.aac') || pathname.endsWith('.m4s');
            const cacheTtl = isM3u8 ? CACHE_TTL.m3u8 : isTs ? CACHE_TTL.ts : CACHE_TTL.other;

            // ── CF Cache API ─────────────────────────────────────────────────────────
            const cache = caches.default;
            const cacheKey = new Request(request.url, { method: 'GET' });

            if (request.method === 'GET') {
                const cached = await cache.match(cacheKey);
                if (cached) {
                    const cachedRes = new Response(cached.body, cached);
                    cachedRes.headers.set('X-Cache', 'HIT');
                    cachedRes.headers.set('Access-Control-Allow-Origin', '*');
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
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            const isM3u8ByContent = isM3u8 || contentType.includes('mpegurl') || contentType.includes('x-mpegurl');

            // Build response headers
            const resHeaders = new Headers(response.headers);
            resHeaders.set('Access-Control-Allow-Origin', '*');
            resHeaders.set('Access-Control-Expose-Headers', '*');
            resHeaders.set('Cache-Control', `public, max-age=${cacheTtl}, stale-while-revalidate=${cacheTtl * 2}`);
            resHeaders.set('X-Cache', 'MISS');
            resHeaders.set('X-Proxy-Target', targetUrl);
            resHeaders.delete('X-Frame-Options');
            resHeaders.delete('Content-Security-Policy');

            // ── M3U8: rewrite URLs trong playlist ──────────────────────────────────
            if (isM3u8ByContent && response.status === 200 && request.method !== 'HEAD') {
                const text = await response.text();
                const pathDir = parsedTarget.pathname.replace(/[^/]*$/, '');
                const cdnBase = `${parsedTarget.protocol}//${parsedTarget.hostname}${pathDir}`;
                const hostBase = `${parsedTarget.protocol}//${parsedTarget.hostname}`;
                
                const cfWorkerOrigin = `${url.protocol}//${url.host}`;
                const refEncoded = encodeURIComponent(referer);

                const resolveUrl = (relOrAbs) => {
                    if (relOrAbs.startsWith('http')) return relOrAbs;
                    if (relOrAbs.startsWith('/')) return hostBase + relOrAbs;
                    return cdnBase + relOrAbs;
                };

                const rewrittenText = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return line;

                    // Rewrite URI="..." in #EXT tags (such as #EXT-X-MEDIA, #EXT-X-KEY, #EXT-X-MAP)
                    if (trimmed.startsWith('#')) {
                        if (trimmed.includes('URI="')) {
                            return line.replace(/URI="([^"]+)"/g, (_, uriMatch) => {
                                const abs = resolveUrl(uriMatch);
                                return `URI="${cfWorkerOrigin}/?url=${encodeURIComponent(abs)}&ref=${refEncoded}"`;
                            });
                        }
                        return line;
                    }

                    const absUrl = resolveUrl(trimmed);
                    return `${cfWorkerOrigin}/?url=${encodeURIComponent(absUrl)}&ref=${refEncoded}`;
                }).join('\n');

                resHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
                resHeaders.set('Content-Length', String(new TextEncoder().encode(rewrittenText).length));

                const finalRes = new Response(rewrittenText, { status: 200, headers: resHeaders });
                ctx.waitUntil(cache.put(cacheKey, finalRes.clone()));
                return finalRes;
            }

            // ── Non-m3u8 (TS segments, etc.): stream thẳng về client ───────────────
            const finalRes = new Response(
                request.method === 'HEAD' ? null : response.body,
                { status: response.status, headers: resHeaders }
            );

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
