const scrap = require('./scraper_bongda24h.js');
const cheerio = require('cheerio');

async function debugImg() {
    const FIFA_URL = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    const res = await fetch(FIFA_URL);
    const html = await res.text();
    const $ = cheerio.load(html);
    const table = $('table').first();
    const firstRow = table.find('tr').eq(1); 
    const imgHtml = firstRow.find('img').parent().html();
    console.log('Img Parent HTML:', imgHtml);
}
debugImg();
