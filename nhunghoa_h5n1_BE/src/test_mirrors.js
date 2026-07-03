async function testMirrors() {
    const mirrors = [
        'https://sv2.tieulam2.info',
        'https://sv1.tieulam2.info'
    ];
    for (const mirror of mirrors) {
        try {
            console.log(`\nTesting mirror: ${mirror}`);
            const res = await fetch(mirror, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
                signal: AbortSignal.timeout(10000)
            });
            console.log(`Status: ${res.status}`);
            if (res.ok) {
                const html = await res.text();
                console.log(`HTML length: ${html.length}`);
                
                // Print JS files inside HTML
                const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
                let m;
                let foundJs = [];
                while ((m = scriptRegex.exec(html)) !== null) {
                    foundJs.push(m[1]);
                }
                console.log('Script tags found:', foundJs);
                
                // Let's resolve the bundle
                const jsMatch = html.match(/src="(\/assets\/index-[a-zA-Z0-9_-]+\.js)"/) || 
                                html.match(/src="(\/_nuxt\/[a-zA-Z0-9_-]+\.js)"/);
                let jsPath = jsMatch ? jsMatch[1] : foundJs.find(src => src.includes('index-') || src.includes('_nuxt/'));
                if (jsPath) {
                    const jsUrl = jsPath.startsWith('http') ? jsPath : `${mirror}${jsPath}`;
                    console.log(`Fetching JS bundle: ${jsUrl}`);
                    const jsRes = await fetch(jsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
                    if (jsRes.ok) {
                        const jsText = await jsRes.text();
                        console.log(`JS length: ${jsText.length}`);
                        const apiMatch = jsText.match(/https?:\/\/(api\.tlap[0-9]+\.[a-zA-Z0-9.-]+)/);
                        const mainApiDomain = apiMatch ? apiMatch[1] : null;
                        const scoreMatch = jsText.match(/score-client\.(tl[0-9]+)\.com/);
                        const scoreApiDomain = scoreMatch ? `score-api.${scoreMatch[1]}.com` : null;
                        console.log(`  Resolved Main API: ${mainApiDomain}`);
                        console.log(`  Resolved Score API: ${scoreApiDomain}`);
                    } else {
                        console.log(`  Failed to fetch JS bundle: status ${jsRes.status}`);
                    }
                } else {
                    console.log('  No JS bundle path matching index- or _nuxt/ found in HTML.');
                }
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testMirrors();
