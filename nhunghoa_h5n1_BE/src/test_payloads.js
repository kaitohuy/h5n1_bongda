const { fetchGavangMatches } = require('./scraper_gavang.js');

const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://xem1.gv05.live',
    'Referer': 'https://xem1.gv05.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};
const MATCHES_QUERY = `{ matches { id team_1 team_2 start_date status is_live is_hot is_top desc } }`;

async function testV2() {
    const payloads = [
        // 1. Live + Có BLV
        { limit: 50, page: 1, order_asc: "start_date", queries: [{ field: "is_live", type: "equal", value: true }] },
        // 2. Hot
        { limit: 50, page: 1, order_asc: "start_date", queries: [{ field: "is_hot", type: "equal", value: true }] },
        // 3. Top
        { limit: 50, page: 1, order_asc: "start_date", queries: [{ field: "is_top", type: "equal", value: true }] },
        // 4. Hôm nay (All)
        { limit: 100, page: 1, order_asc: "start_date" }
    ];

    try {
        let allMatches = [];
        let seenIds = new Set();

        for (let i = 0; i < payloads.length; i++) {
            const p = payloads[i];
            const body = JSON.stringify({ query: MATCHES_QUERY, ...p });
            console.log(`\n--- Fetching Payload ${i + 1} ---`);
            const res = await fetch(`${GAVANG_API}/matches/graph`, { method: 'POST', headers: API_HEADERS, body });
            const json = await res.json();
            const arr = json.data || json.matches || [];
            console.log(`Found ${arr.length} matches.`);

            for (const m of arr) {
                if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    allMatches.push(m);
                }
            }
        }

        console.log(`\n=> Total Unique Matches: ${allMatches.length}`);
        console.log(`Live: ${allMatches.filter(m => m.is_live).length}`);
        console.log(`Hot/Top: ${allMatches.filter(m => m.is_hot || m.is_top).length}`);
        console.log(`Example Monterrey match:`, allMatches.find(m => m.team_1.includes('Monterrey') || m.team_2.includes('Monterrey')));

    } catch (e) { console.error('Error:', e); }
}
testV2();
