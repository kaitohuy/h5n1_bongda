const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://xem1.gv05.live',
    'Referer': 'https://xem1.gv05.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const query = `{
  matches {
    id slug team_1 team_2 league
    team_1_logo team_2_logo
    team_1_score team_2_score
    start_date status is_live is_hot is_top
    blv desc source_live
  }
}`;

async function test() {
    try {
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query })
        });
        const json = await res.json();
        const allMatches = json.data || json.matches || [];
        const matches = allMatches.filter(m => m.is_live);
        if (matches.length > 0) {
            const m = matches[0];
            console.log(`Testing LIVE Match: ${m.team_1} vs ${m.team_2}`);
            console.log('Match GraphQL Object Keys:', Object.keys(m));
            console.log('Match GraphQL Score:', m.team_1_score, '-', m.team_2_score);
            
            const liveRes = await fetch(`${GAVANG_API}/match/${m.id}/live`, { headers: API_HEADERS });
            const liveData = await liveRes.json();
            console.log('Live REST API object keys:', Object.keys(liveData));
            console.log('Live REST API full object:', JSON.stringify(liveData, null, 2));
        } else {
            console.log('No live matches found to test.');
            
            // Test a completed match
            const m = allMatches.find(m => m.status && (m.status.includes('end') || m.status.includes('finish') || m.status.includes('ft')));
            if (m) {
                console.log(`Testing FINISHED Match: ${m.team_1} vs ${m.team_2}`);
                console.log('Match GraphQL Object Keys:', Object.keys(m));
                console.log('Match GraphQL Score:', m.team_1_score, '-', m.team_2_score);
                const liveRes = await fetch(`${GAVANG_API}/match/${m.id}/live`, { headers: API_HEADERS });
                const liveData = await liveRes.json();
                console.log('Live REST API object keys:', Object.keys(liveData));
                console.log('Live REST API full object:', JSON.stringify(liveData, null, 2));
            } else {
                console.log('No completed matches found either. Printing first match object keys:');
                if (allMatches.length > 0) console.log(Object.keys(allMatches[0]));
            }
        }
    } catch (e) { console.error('Error:', e); }
}
test();
