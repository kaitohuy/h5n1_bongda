const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = { 'Content-Type': 'application/json', 'Origin': 'https://xem1.gv05.live', 'Referer': 'https://xem1.gv05.live/' };

const FULL_QUERY = `{
  matches(limit: 5, queries: [{field: "is_live", type: "equal", value: true}]) {
    id team_1 team_2 team_1_score team_2_score blv play_time match_time minute status
  }
}`;

async function test() {
    try {
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query: FULL_QUERY })
        });
        const text = await res.text();
        console.log(text);
    } catch (e) { console.error(e); }
}
test();
