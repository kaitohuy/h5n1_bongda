const cheerio = require('cheerio');

async function inspectFifa() {
    const url = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        
        console.log('--- Search for VN Rank ---');
        $('*').each((i, el) => {
            const text = $(el).text().trim();
            if (text.includes('Thứ hạng Việt Nam:')) {
                console.log(`Tag: ${el.tagName}, Text: "${text.substring(0, 50)}..."`);
            }
        });

        const table = $('table').first();
        const firstRow = table.find('tr').eq(1); // row 0 is header
        console.log('--- Row 1 Logo Inspection ---');
        const teamCol = firstRow.find('td').eq(1);
        console.log('Team Col HTML:', $.html(teamCol));
        console.log('Img attributes:', teamCol.find('img').attr());

        // Check Vietnam row specifically
        console.log('--- Vietnam Row Inspection ---');
        table.find('tr').each((i, tr) => {
            if ($(tr).text().includes('Việt Nam')) {
                console.log(`Vietnam Row HTML snippet: ${$.html($(tr)).substring(0, 300)}...`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

inspectFifa();
