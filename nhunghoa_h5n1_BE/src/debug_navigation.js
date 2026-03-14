const cheerio = require('cheerio');
const fs = require('fs');

function debugNavigation() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    let navigation = [];
    console.log('Searching for .m-list...');
    const mLists = $('.sidebar-left .m-list, #left .m-list, .sidebar .m-list, .m-list');
    console.log(`Found ${mLists.length} matches for .m-list`);

    mLists.each((i, el) => {
        const regionName = $(el).find('.m-title').first().text().trim();
        console.log(`- Item ${i}: title found -> "${regionName}"`);
        if (regionName) {
            let regionItem = { name: regionName, leagues: [] };
            $(el).find('.m-sub a, ul li a').each((j, a) => {
                const leagueName = $(a).text().trim();
                let href = $(a).attr('href');
                console.log(`  * League: ${leagueName} -> ${href}`);
                if (leagueName && href) {
                    regionItem.leagues.push({ name: leagueName, fullUrl: href });
                }
            });
            if (regionItem.leagues.length > 0) {
                navigation.push(regionItem);
            }
        }
    });

    console.log('\nFinal Navigation Result count:', navigation.length);
}

debugNavigation();
