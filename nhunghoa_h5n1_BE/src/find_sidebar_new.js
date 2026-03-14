const cheerio = require('cheerio');
const fs = require('fs');

function findSidebar() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);

    console.log('--- Checking .cate-item ---');
    $('.cate-item').each((i, el) => {
        const title = $(el).find('> a').text().trim();
        console.log(`Cate ${i}: [${title}]`);
        $(el).find('ul li a').each((j, a) => {
            console.log(`  - ${$(a).text().trim()}`);
        });
    });

    console.log('--- Checking .menu-left ---');
    $('.menu-left li').each((i, el) => {
        const title = $(el).find('> a').text().trim();
        if (title) {
            console.log(`Menu Item ${i}: [${title}]`);
        }
    });

    console.log('--- Checking .box-cate ---');
    $('.box-cate').each((i, el) => {
        const title = $(el).find('.title-box, .title-cate').text().trim();
        console.log(`Box Cate ${i}: [${title}]`);
    });
}

findSidebar();
