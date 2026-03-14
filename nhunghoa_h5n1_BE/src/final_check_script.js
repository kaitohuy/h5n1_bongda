const scrap = require('./scraper_bongda24h.js');
const fs = require('fs');

async function finalCheck() {
    try {
        const data = await scrap.getStandings();
        const fifa = data.leagues.find(l => l.category === 'BXH FIFA');
        fs.writeFileSync('C:/Users/ADMIN/AppData/Local/Temp/final_check.json', JSON.stringify(fifa, null, 2));
        console.log('Final check written to temp file.');
    } catch (e) {
        console.error(e);
    }
}
finalCheck();
