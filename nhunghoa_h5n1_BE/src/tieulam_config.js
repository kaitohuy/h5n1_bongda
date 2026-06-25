let cachedApiDomain = null;
let cachedApiDomainTime = 0;

let cachedScoreApiDomain = null;
let cachedScoreApiDomainTime = 0;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function resolveDomains() {
    const now = Date.now();
    const mirrors = [
        'https://sv2.tieulam.info',
        'https://sv1.tieulamlive.net',
        'https://sv1.tieulamlive.com',
        'https://sv1.tieulam1.live',
        'https://tieulam.tv'
    ];
    
    for (const mirror of mirrors) {
        try {
            const res = await fetch(mirror, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(6000)
            });
            if (res.ok) {
                const html = await res.text();
                let jsPath = null;
                const jsMatch = html.match(/src="(\/assets\/index-[a-zA-Z0-9_-]+\.js)"/) || 
                                html.match(/src="(\/_nuxt\/[a-zA-Z0-9_-]+\.js)"/);
                                
                if (jsMatch && jsMatch[1]) {
                    jsPath = jsMatch[1];
                } else {
                    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
                    let m;
                    while ((m = scriptRegex.exec(html)) !== null) {
                        if (m[1].includes('index-') || m[1].includes('_nuxt/')) {
                            jsPath = m[1];
                            break;
                        }
                    }
                }
                
                if (jsPath) {
                    const jsUrl = jsPath.startsWith('http') ? jsPath : `${mirror}${jsPath}`;
                    const jsRes = await fetch(jsUrl, { signal: AbortSignal.timeout(6000) });
                    if (jsRes.ok) {
                        const jsText = await jsRes.text();
                        
                        // 1. Resolve main API domain
                        const apiMatch = jsText.match(/https?:\/\/(api\.tlap[0-9]+\.[a-zA-Z0-9.-]+)/);
                        const mainApiDomain = apiMatch ? apiMatch[1] : null;
                        
                        // 2. Resolve score API domain
                        const scoreMatch = jsText.match(/score-client\.(tl[0-9]+)\.com/);
                        const scoreApiDomain = scoreMatch ? `score-api.${scoreMatch[1]}.com` : null;
                        
                        if (mainApiDomain && scoreApiDomain) {
                            cachedApiDomain = mainApiDomain;
                            cachedApiDomainTime = now;
                            cachedScoreApiDomain = scoreApiDomain;
                            cachedScoreApiDomainTime = now;
                            console.log(`[tieulam_config] Dynamically resolved: API=${mainApiDomain}, ScoreAPI=${scoreApiDomain}`);
                            return { mainApiDomain, scoreApiDomain };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`[tieulam_config] Failed to resolve from mirror ${mirror}: ${e.message}`);
        }
    }
    return null;
}

async function getApiDomain() {
    const now = Date.now();
    if (cachedApiDomain && (now - cachedApiDomainTime) < CACHE_TTL) {
        return cachedApiDomain;
    }
    await resolveDomains();
    if (cachedApiDomain) return cachedApiDomain;
    return 'api.tlap17062026.com'; // Fallback
}

async function getScoreApiDomain() {
    const now = Date.now();
    if (cachedScoreApiDomain && (now - cachedScoreApiDomainTime) < CACHE_TTL) {
        return cachedScoreApiDomain;
    }
    await resolveDomains();
    if (cachedScoreApiDomain) return cachedScoreApiDomain;
    return 'score-api.tl17092026.com'; // Fallback
}

module.exports = {
    getApiDomain,
    getScoreApiDomain
};
