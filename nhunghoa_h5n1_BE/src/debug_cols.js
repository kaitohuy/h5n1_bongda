const scrap = require('./scraper_bongda24h.js');
const cheerio = require('cheerio');

async function debugTable() {
    const FIFA_URL = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    const res = await fetch(FIFA_URL);
    const html = await res.text();
    const $ = cheerio.load(html);
    const table = $('table').first();
    const firstRow = table.find('tr').eq(1); // Skip header
    const cols = firstRow.find('td');
    
    console.log('Total Columns:', cols.length);
    cols.each((i, el) => {
        console.log(`Col ${i}: "${$(el).text().trim()}"`);
        if (i === 1) {
            console.log(`  Img info:`, $(el).find('img').attr('data-src'), $(el).find('img').attr('src'));
        }
    });
}
debugTable();
