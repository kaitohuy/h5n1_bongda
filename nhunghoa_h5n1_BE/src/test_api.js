const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://xem1.gv05.live',
    'Referer': 'https://xem1.gv05.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const MATCHES_QUERY = `{
  matches {
    id team_1 team_2 start_date status is_live is_hot desc
  }
}`;

async function test() {
    try {
        console.log('1. Fetching matches list...');
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ query: MATCHES_QUERY })
        });
        const json = await res.json();
        const matches = json.data || json.matches || [];
        console.log(`Found ${matches.length} matches.`);

        const liveMatches = matches.filter(m => m.is_live);
        console.log(`Found ${liveMatches.length} LIVE matches.`);

        if (liveMatches.length > 0) {
            const testMatch = liveMatches[0];
            console.log(`2. Testing /match/${testMatch.id}/live endpoint for ${testMatch.team_1} vs ${testMatch.team_2}...`);

            const liveRes = await fetch(`${GAVANG_API}/match/${testMatch.id}/live`, {
                headers: API_HEADERS
            });
            console.log('Status code:', liveRes.status);
            const liveData = await liveRes.json();
            console.log('Live API Response:', JSON.stringify(liveData, null, 2));
        } else {
            console.log('No live matches right now. Let me test the first non-live match (football) just in case...');
            const football = matches.filter(m => m.desc === 'FOOTBALL');
            if (football.length > 0) {
                const testMatch = football[0];
                console.log(`Testing /match/${testMatch.id}/live endpoint for ${testMatch.team_1} vs ${testMatch.team_2}...`);
                const liveRes = await fetch(`${GAVANG_API}/match/${testMatch.id}/live`, {
                    headers: API_HEADERS
                });
                console.log('Status code:', liveRes.status);
                const liveData = await liveRes.json();
                console.log('Response:', JSON.stringify(liveData, null, 2));
            }
        }
    } catch (e) { console.error('Error:', e); }
}
test();
