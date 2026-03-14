const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://xem1.gv05.live',
    'Referer': 'https://xem1.gv05.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function guessField(field) {
    const query = `{ matches(limit: 1) { id ${field} } }`;
    try {
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query })
        });
        const json = await res.json();
        if (json.errors) return null;
        if (!json.data || !json.data.matches || json.data.matches.length === 0) return null;
        return json.data.matches[0][field] !== undefined ? json.data.matches[0][field] : 'undefined';
    } catch (e) {
        return null;
    }
}

async function test() {
    console.log('Guessing GraphQL fields...');
    const fieldsToGuess = ['minute', 'time', 'match_time', 'live_time', 'current_time', 'score', 'live_minute', 'play_time', 'status_time', 'timer', 'match_minute'];
    for (const f of fieldsToGuess) {
        const val = await guessField(f);
        if (val !== null) console.log(`SUCCESS: field '${f}' exists! Value:`, val);
    }
    
    console.log('Testing REST API full payload for the first match...');
    const query = `{ matches(limit: 1) { id } }`;
    const res = await fetch(`${GAVANG_API}/matches/graph`, {
        method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.data && json.data.matches && json.data.matches.length > 0) {
        const id = json.data.matches[0].id;
        console.log('Testing REST API for match id:', id);
        try {
            const liveRes = await fetch(`${GAVANG_API}/match/${id}/live`, { headers: API_HEADERS });
            const liveData = await liveRes.json();
            console.log('REST API keys:', Object.keys(liveData));
            console.log('REST API subset:', JSON.stringify(liveData).substring(0, 500));
        } catch(e) { console.log('REST API fetch error', e); }
    }
}
test();
