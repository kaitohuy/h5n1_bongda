const { getApiDomain } = require('./tieulam_config');

async function testApi() {
    try {
        const apiDomain = await getApiDomain();
        console.log(`Using API Domain: ${apiDomain}`);
        
        const res = await fetch(`https://${apiDomain}/matches/graph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            body: JSON.stringify({ fields: [], queries: [], limit: 20, page: 1, order_asc: "start_date" })
        });
        const json = await res.json();
        const matches = json.data || [];
        console.log(`Got ${matches.length} matches.`);
        
        for (let i = 0; i < Math.min(5, matches.length); i++) {
            const m = matches[i];
            console.log(`Match ${i}: ${m.title}`);
            console.log(`  is_live: ${m.is_live}`);
            console.log(`  stream_key: ${m.stream_key}`);
            console.log(`  source_live: ${m.source_live}`);
            console.log(`  is_hot: ${m.is_hot}`);
            console.log(`  is_top: ${m.is_top}`);
        }
    } catch (e) {
        console.error(e);
    }
}

testApi();
