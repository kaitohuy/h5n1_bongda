const cheerio = require('cheerio');

async function main() {
    console.log('Searching for borders...');
    const res = await fetch('https://bongda24h.vn/vck-world-cup/vong-loai-truc-tiep.html', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const table = $('table.table-wcp').first();
    table.find('td').each((i, td) => {
        const style = $(td).attr('style') || '';
        if (style.includes('border')) {
            console.log(`Cell index ${i} has style: "${style}"`);
        }
    });
}

main().catch(console.error);
