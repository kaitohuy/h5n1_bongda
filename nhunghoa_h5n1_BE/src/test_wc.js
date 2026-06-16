const cheerio = require('cheerio');

async function run() {
    const url = 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-chau-a/bang-xep-hang-82.html';
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const table = $('table').first();
        console.log('--- Asian Qualifier Table 1 Rows HTML ---');
        table.find('tr').slice(0, 3).each((i, tr) => {
            console.log(`\nRow ${i} outer HTML:`);
            console.log($.html(tr));
        });
    } catch (e) {
        console.error(e);
    }
}
run();
