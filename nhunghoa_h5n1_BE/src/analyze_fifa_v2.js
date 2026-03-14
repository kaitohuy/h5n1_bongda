const cheerio = require('cheerio');

async function analyzeFifaFull() {
    const url = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        
        console.log('--- FIFA Rank Vietnam ---');
        const vnRank = $('.text-danger, p, div').filter((i, el) => $(el).text().includes('Thứ hạng Việt Nam')).first().text().trim();
        console.log('Detected VN Rank Text:', vnRank);

        const table = $('table').first();
        const firstRow = table.find('tbody tr, tr').eq(1);
        console.log('--- Row 1 HTML ---');
        console.log($.html(firstRow));
        
        const logo = firstRow.find('img').attr('src');
        console.log('Logo found:', logo);
        
        // Find Vietnam row
        let vnRowData = null;
        table.find('tr').each((i, tr) => {
            if ($(tr).text().includes('Việt Nam')) {
                vnRowData = $(tr).text().trim().replace(/\s+/g, ' ');
            }
        });
        console.log('Vietnam Row Data:', vnRowData);

    } catch (e) {
        console.error(e);
    }
}

analyzeFifaFull();
