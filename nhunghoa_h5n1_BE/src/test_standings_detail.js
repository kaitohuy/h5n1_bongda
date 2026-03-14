const { getStandings, fetchDetailedStandings } = require('./scraper_bongda24h');

async function test() {
    console.log('--- Testing getStandings (Extracting fullUrl) ---');
    const leagues = await getStandings();
    const epl = leagues.find(l => l.leagueName.includes('Ngoại hạng Anh'));
    
    if (epl) {
        console.log(`Found EPL: ${epl.leagueName}`);
        console.log(`Teams count: ${epl.teams.length}`);
        console.log(`Full URL: ${epl.fullUrl}`);
        
        if (epl.fullUrl) {
            console.log('\n--- Testing fetchDetailedStandings ---');
            const fullTeams = await fetchDetailedStandings(epl.fullUrl);
            if (fullTeams && fullTeams.length > 0) {
                console.log(`SUCCESS: Fetched ${fullTeams.length} teams for EPL.`);
                console.log('Sample Team:', fullTeams[0]);
            } else {
                console.log('FAILED: No teams fetched for detailed standings.');
            }
        } else {
            console.log('FAILED: No fullUrl found for EPL.');
        }
    } else {
        console.log('FAILED: EPL not found in standings.');
        console.log('Available leagues:', leagues.map(l => l.leagueName).join(', '));
    }
}

test();
