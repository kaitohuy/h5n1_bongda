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
        const matches = json.data.matches || json.matches || [];
        
        console.log("Total matches:", matches.length);
        
        // Print 2 live matches
        const live = matches.filter(m => m.is_live);
        console.log("LIVE MATCHES (first 2):");
        console.log(JSON.stringify(live.slice(0, 2), null, 2));

        // Print 2 finished matches
        const finished = matches.filter(m => m.status && m.status.includes('end'));
        console.log("FINISHED MATCHES (first 2):");
        console.log(JSON.stringify(finished.slice(0, 2), null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
