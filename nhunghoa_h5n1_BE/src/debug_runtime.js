const path = require('path');
const scrapPath = require.resolve('./scraper_bongda24h.js');
console.log('Scraper Absolute Path:', scrapPath);

const scrap = require('./scraper_bongda24h.js');

async function debugFinal() {
    try {
        scrap.clearCache();
        const data = await scrap.getStandings();
        const fifa = data.leagues.find(l => l.category === 'BXH FIFA');
        if (fifa) {
            console.log('--- FIFA DEBUG ---');
            console.log('vnRank field exists:', 'vnRank' in fifa);
            console.log('vnRank value:', fifa.vnRank);
            console.log('Teams count:', fifa.teams.length);
            if (fifa.teams.length > 0) {
                console.log('Team 0 keys:', Object.keys(fifa.teams[0]));
                console.log('Team 0 region:', fifa.teams[0].region);
                console.log('Team 0 logo:', fifa.teams[0].logo);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
debugFinal();
