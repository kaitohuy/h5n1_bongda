async function checkApi() {
    try {
        const res = await fetch('http://localhost:8000/api/standings');
        const data = await res.json();
        const fifa = data.leagues.find(l => l.category === 'BXH FIFA');
        if (fifa) {
            console.log('--- FIFA LEAGUE OBJECT ---');
            console.log('Name:', fifa.leagueName);
            console.log('vnRank:', fifa.vnRank);
            console.log('Category:', fifa.category);
            console.log('First Team:', {
                name: fifa.teams[0].teamName,
                region: fifa.teams[0].region,
                logo: fifa.teams[0].logo
            });
            console.log('JSON keys:', Object.keys(fifa));
        } else {
            console.log('FIFA League NOT found in leagues array');
            console.log('Available categories:', data.leagues.map(l => l.category));
        }
    } catch (e) {
        console.error('API Check failed:', e.message);
    }
}
checkApi();
