const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
const $ = cheerio.load(html);

console.log("--- BONGDA24H SIDEBAR ---");

// Let's find the left sidebar container. From screenshot, it has "GIẢI NỔI BẬT" and "KHU VỰC"
$('.menu-left, .left-menu, .box-left, .menu-bxh').each((i, menu) => {
    // For each menu, find groups
    $(menu).find('.box').each((j, box) => {
        const title = $(box).find('.title-box, .title').text().trim();
        console.log(`\nGroup: ${title}`);
        
        // Find links inside
        $(box).find('ul li a').each((k, link) => {
            console.log(`  - ${$(link).text().trim()}`);
        });
    });
});
