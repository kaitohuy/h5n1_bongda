const { fetchGavangMatches } = require('./scraper_gavang');

async function test() {
    try {
        const res = await fetchGavangMatches();
        console.log(`Received ${res.matches.length} matches`);
        
        const live = res.matches.filter(m => m.status === 'Trực tiếp');
        console.log('--- 1 LIVE MATCH ---');
        console.log(JSON.stringify(live[0], null, 2));
        
        const finished = res.matches.filter(m => m.status === 'Đã kết thúc');
        console.log('--- 1 FINISHED MATCH ---');
        console.log(JSON.stringify(finished[0], null, 2));
        
        // Wait, the real payload from API is cached inside scraper. I want to see the RAW GraphQL response!
        console.log('To see raw GraphQL response, I will also fetch it correctly:');
        const GAVANG_API = 'https://api-gavang.gvtv1.com';
        const API_HEADERS = {
            'Content-Type': 'application/json',
            'Origin': 'https://xem1.gv05.live',
            'Referer': 'https://xem1.gv05.live/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        const MATCHES_QUERY = `{
          matches {
            id slug team_1 team_2 league
            team_1_score team_2_score
            start_date status is_live is_hot is_top
            blv desc source_live
          }
        }`;
        const queryRes = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query: MATCHES_QUERY, limit: 10, page: 1 })
        });
        const json = await queryRes.json();
        const rawMatches = json.data || json.matches || [];
        console.log('--- 1 RAW MATCH ---');
        console.log(JSON.stringify(rawMatches[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
