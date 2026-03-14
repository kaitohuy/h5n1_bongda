const fs = require('fs');
const cheerio = require('cheerio');

async function test() {
    try {
        const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
        const $ = cheerio.load(html);

        // Find the main standings tables
        // bongda24h usually uses <article class="item-bxh"> or <table class="table-bxh">
        
        let leagues = [];

        $('.tieude-bxh').each((i, el) => {
            const leagueName = $(el).text().trim();
            const table = $(el).next().find('table');
            
            if (table.length > 0) {
                let teams = [];
                table.find('tbody tr').each((j, tr) => {
                    const cols = $(tr).find('td');
                    if (cols.length >= 6) {
                        const rank = $(cols[0]).text().trim();
                        // Team name usually in the 2nd col with an image
                        const teamName = $(cols[1]).find('a').attr('title') || $(cols[1]).text().trim();
                        const logo = $(cols[1]).find('img').attr('src');
                        const matches = $(cols[2]).text().trim();
                        const won = $(cols[3]).text().trim();
                        const drawn = $(cols[4]).text().trim();
                        const lost = $(cols[5]).text().trim();
                        const difference = $(cols[6]).text().trim();
                        const points = $(cols[7]).text().trim();
                        
                        teams.push({ rank, teamName, logo, matches, won, drawn, lost, difference, points });
                    }
                });
                
                if (teams.length > 0) {
                    leagues.push({ leagueName, teams: teams.slice(0, 3) }); // just print first 3 teams
                }
            }
        });
        
        console.log("Leagues found via .tieude-bxh:", leagues.length);
        if (leagues.length > 0) {
            console.log(JSON.stringify(leagues[0], null, 2));
        } else {
            // Let's print some classes if not found
            console.log("No .tieude-bxh found. Trying to find any table...");
            const tables = $('table');
            console.log("Total tables found:", tables.length);
            // Print the first table's header
            if (tables.length > 0) {
                console.log("First table headers:", $(tables[0]).find('th').map((i, el) => $(el).text().trim()).get());
                console.log("First table row 1:", $(tables[0]).find('tr').eq(1).find('td').map((i, el) => $(el).text().trim()).get());
            }
        }
        
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
