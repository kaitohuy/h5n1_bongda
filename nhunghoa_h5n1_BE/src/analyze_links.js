const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
const $ = cheerio.load(html);

console.log("Analyzing Sections...");
$('.section-content').each((i, section) => {
    const heading = $(section).find('h2, h3').first().text().trim();
    const moreLink = $(section).find('a').filter((_, a) => {
        const text = $(a).text().toLowerCase();
        return text.includes('xem') || text.includes('đầy đủ') || text.includes('chi tiết');
    }).attr('href');
    
    console.log(`Section ${i}: ${heading}`);
    if (moreLink) {
        console.log(`  -> More Link: ${moreLink}`);
    } else {
        console.log(`  -> No 'More' link found in section content.`);
    }
});
