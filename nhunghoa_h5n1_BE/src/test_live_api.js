const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://xem1.gv05.live',
    'Referer': 'https://xem1.gv05.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

const MATCHES_QUERY = `{
  matches {
    id team_1 team_2 start_date status is_live is_hot desc
  }
}`;

async function test() {
    try {
        console.log('1. Lấy danh sách trận đấu từ GraphQL API...');
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ query: MATCHES_QUERY })
        });
        const json = await res.json();
        const matches = json.data || json.matches || [];

        const liveMatches = matches.filter(m => m.is_live && m.desc === 'FOOTBALL');
        console.log(`Tìm thấy ${liveMatches.length} trận BÓNG ĐÁ ĐANG LIVE.`);

        if (liveMatches.length > 0) {
            for (let i = 0; i < Math.min(3, liveMatches.length); i++) {
                const testMatch = liveMatches[i];
                console.log(`\n2. Test API /match/${testMatch.id}/live cho trận: ${testMatch.team_1} vs ${testMatch.team_2}...`);
                const liveRes = await fetch(`${GAVANG_API}/match/${testMatch.id}/live`, {
                    headers: API_HEADERS
                });
                console.log(`Status code: ${liveRes.status}`);
                if (liveRes.ok) {
                    const liveData = await liveRes.json();
                    console.log(`Kết quả:`, JSON.stringify(liveData, null, 2));
                } else {
                    console.log(`Lỗi:`, await liveRes.text());
                }
            }
        } else {
            console.log('Hiện tại không có trận bóng đá nào đang LIVE để test endpoint stream.');
        }
    } catch (e) {
        console.error('API Error:', e.message);
    }
}
test();
