async function run() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    };
    
    const testCases = [
        { id: 82, type: 1 },
        { id: 82, type: 2 },
        { id: 89, type: 1 },
        { id: 89, type: 2 }
    ];

    for (const tc of testCases) {
        try {
            const url = `https://bongda24h.vn/WorldCup/AjaxRankingTableByLeague?footballSeasonId=${tc.id}&type=${tc.type}`;
            console.log(`\nFetching: ${url}`);
            const res = await fetch(url, { headers });
            const text = await res.text();
            console.log(`Result length: ${text.length}`);
            console.log(`Preview (150 chars): ${text.substring(0, 150)}`);
        } catch (e) {
            console.error(e);
        }
    }
}
run();
