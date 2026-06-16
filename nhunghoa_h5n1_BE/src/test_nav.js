const cheerio = require('cheerio');

async function run() {
    const url = 'https://bongda24h.vn/bang-xep-hang.html';
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);

        console.log('--- m-list Navigation Elements ---');
        $('.m-list').each((i, el) => {
            const regionName = $(el).find('.m-title').first().text().trim();
            console.log(`Region: "${regionName}"`);
            $(el).find('.m-sub a, a').each((j, a) => {
                const leagueName = $(a).text().trim();
                let href = $(a).attr('href');
                if (leagueName && href && !$(a).hasClass('m-title')) {
                    console.log(`  - League: "${leagueName}", href: "${href}"`);
                }
            });
        });

        console.log('\n--- sidebar / menu-main-all Navigation Elements ---');
        $('.menu-main-all .box, .sidebar-left .box, .left-menu .box, .box-cate').each((i, box) => {
            let boxTitle = $(box).find('.title-box, .title, .title-cate').first().text().trim();
            console.log(`Box: "${boxTitle}"`);
            $(box).find('ul > li').each((j, li) => {
                const regionA = $(li).find('> a');
                const regionName = regionA.text().trim();
                console.log(`  Region: "${regionName}"`);
                $(li).find('ul.sub li a, ul li a').each((k, subA) => {
                    console.log(`    - SubLeague: "${$(subA).text().trim()}", href: "${$(subA).attr('href')}"`);
                });
            });
        });

    } catch (e) {
        console.error(e);
    }
}
run();
