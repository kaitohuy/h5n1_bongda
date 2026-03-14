const cheerio = require('cheerio');

async function analyzeFifaHtml() {
    const url = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const table = $('table').first();
        console.log('--- FIFA First Row HTML ---');
        const firstRow = table.find('tbody tr, tr').eq(1);
        console.log($.html(firstRow));
    } catch (e) {
        console.error(e);
    }
}

analyzeFifaHtml();
