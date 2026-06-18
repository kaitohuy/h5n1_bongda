const { fetchMatches } = require('./scraper_tieulamtv');

async function main() {
    console.log('Testing Tiếu Lâm TV module import and execution...');
    try {
        const matches = await fetchMatches();
        console.log(`Success! Fetched ${matches.length} matches.`);
        if (matches.length > 0) {
            console.log('Sample match:', JSON.stringify({
                home: matches[0].home,
                away: matches[0].away,
                league: matches[0].league,
                status: matches[0].status,
                serversCount: matches[0].servers.length
            }, null, 2));
        }
    } catch (err) {
        console.error('Error in scraper_tieulamtv execution:', err);
    }
}

main();
