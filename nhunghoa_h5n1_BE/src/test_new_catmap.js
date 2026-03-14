const cheerio = require('cheerio');
const fs = require('fs');

async function testCatMap() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);

    let catMap = {};
    // Tìm các box có thể chứa menu
    $('.menu-main-all .box, .sidebar-left .box, .left-menu .box, .menu-left .box, #left .box, .box-cate').each((i, box) => {
        let boxTitle = $(box).find('.title-box, .title, .title-cate').first().text().trim();
        console.log(`Analyzing Box: [${boxTitle}]`);

        // Nếu box là "KHU VỰC", các mục li > a có thể là Tên Khu Vực
        // Và bên trong li > ul > li > a có thể là Tên Giải Đấu
        $(box).find('ul > li').each((j, li) => {
            const regionA = $(li).find('> a');
            const regionName = regionA.text().trim();
            
            // Map chính regionName (VD: "Anh")
            if (regionName) {
                console.log(`  Region: [${regionName}]`);
                catMap[regionName] = regionName;
                const regionHref = regionA.attr('href');
                if (regionHref) catMap[regionHref] = regionName;

                // Tìm các giải đấu bên trong (sub menu)
                $(li).find('ul.sub li a').each((k, subA) => {
                    const leagueName = $(subA).text().trim();
                    const leagueHref = $(subA).attr('href');
                    console.log(`    Sub-League: [${leagueName}] -> ${regionName}`);
                    catMap[leagueName] = regionName;
                    if (leagueHref) catMap[leagueHref] = regionName;
                });
            }
        });
    });

    console.log('--- Resulting catMap (Sample) ---');
    const keys = Object.keys(catMap);
    keys.slice(0, 20).forEach(k => console.log(`${k} => ${catMap[k]}`));
}

testCatMap();
