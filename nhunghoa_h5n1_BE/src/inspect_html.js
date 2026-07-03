async function inspectHTML() {
    const urls = ['https://tieulamtv.co', 'https://tieulamtv.app'];
    for (const url of urls) {
        try {
            console.log(`\nInspecting: ${url}`);
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(10000)
            });
            const html = await res.text();
            
            // Search for domains like .info, .net, .com, .xyz, sv1, sv2
            const domainRegex = /([a-zA-Z0-9-]+\.(info|net|com|live|xyz|tv|co|app|net))/g;
            let match;
            const foundDomains = new Set();
            while ((match = domainRegex.exec(html)) !== null) {
                foundDomains.add(match[1]);
            }
            console.log(`Found domains in ${url}:`, Array.from(foundDomains).filter(d => !d.includes('wordpress') && !d.includes('w.org') && !d.includes('google')));
            
            // Search for iframes
            const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
            let iframeMatch;
            while ((iframeMatch = iframeRegex.exec(html)) !== null) {
                console.log(`Found iframe src: ${iframeMatch[1]}`);
            }
        } catch (e) {
            console.error(`Error inspecting ${url}: ${e.message}`);
        }
    }
}
inspectHTML();
