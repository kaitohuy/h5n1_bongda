const cheerio = require('cheerio');

async function debugSidebar() {
    const url = 'https://bongda24h.vn/bang-xep-hang.html';
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);

        console.log('--- Sidebar Boxes ---');
        $('.sidebar-left .box, .left-menu .box, .menu-left .box, #left .box, .menu-main-all .box').each((i, box) => {
            const title = $(box).find('.title-box, .title, .title-cate').text().trim();
            console.log(`Box ${i + 1}: [${title}]`);
            $(box).find('ul li a').each((j, a) => {
                console.log(`  - ${$(a).text().trim()} (${$(a).attr('href')})`);
            });
        });

        if ($('.sidebar-left').length === 0) console.log('No .sidebar-left found');
        if ($('.menu-main-all').length === 0) console.log('No .menu-main-all found');

    } catch (e) {
        console.error(e);
    }
}

debugSidebar();
