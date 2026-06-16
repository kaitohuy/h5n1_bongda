const { getStandings } = require('./scraper_bongda24h');

async function main() {
    console.log('Fetching standings...');
    const result = await getStandings();
    console.log('\n--- Leagues (' + result.leagues.length + ') ---');
    result.leagues.forEach(l => {
        console.log(`- ${l.leagueName} (Category: ${l.category})`);
    });
    console.log('\n--- Navigation (' + result.navigation.length + ') ---');
    result.navigation.forEach(n => {
        console.log(`- Category: ${n.name}`);
        n.leagues.forEach(l => {
            console.log(`  * ${l.name} (${l.fullUrl})`);
        });
    });
}

main().catch(console.error);
