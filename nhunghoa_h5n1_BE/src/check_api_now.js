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
        console.log('1. Fetching matches list from GraphQL API...');
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ query: MATCHES_QUERY })
        });
        const json = await res.json();
        const matches = json.data || json.matches || [];
        console.log(`[RESULT] API is still working! Found ${matches.length} matches.`);
    } catch (e) {
        console.error('API Error:', e.message);
    }
}
test();
