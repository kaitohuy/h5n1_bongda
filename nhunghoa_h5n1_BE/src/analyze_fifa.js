const cheerio = require('cheerio');

async function analyzeFifa() {
    const url = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        
        console.log('--- FIFA Page Tables ---');
        $('table').each((i, table) => {
            console.log(`Table ${i}:`);
            const headers = [];
            $(table).find('thead th, tr:first-child th, tr:first-child td').each((j, el) => {
                headers.push($(el).text().trim());
            });
            console.log('Headers:', headers.join(' | '));
            
            const firstRow = $(table).find('tbody tr, tr').eq(1); // Row after header
            const cols = [];
            firstRow.find('td').each((j, el) => {
                cols.push($(el).text().trim());
            });
            console.log('First Data Row:', cols.join(' | '));
        });
    } catch (e) {
        console.error(e);
    }
}

analyzeFifa();
