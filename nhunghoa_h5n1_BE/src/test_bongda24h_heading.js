const fs = require('fs');
const cheerio = require('cheerio');

async function test() {
    try {
        const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
        const $ = cheerio.load(html);

        let leagues = [];

        // Every table belongs to a league
        $('table').each((i, tableNode) => {
            const table = $(tableNode);
            
            // Try to find the nearest previous heading
            // Let's go up the DOM tree from table, and at each level look for preceding siblings that are headings or contain headings
            let heading = '';
            let current = table;
            
            for (let level = 0; level < 5; level++) {
                // Check if current node's preceding sibling is a heading
                const prev = current.prev();
                if (prev.length > 0) {
                    if (prev.is('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate')) {
                        heading = prev.text().trim();
                        break;
                    }
                    // Or if it contains a heading
                    const hInner = prev.find('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate');
                    if (hInner.length > 0) {
                        heading = hInner.first().text().trim();
                        break;
                    }
                }
                current = current.parent();
                if (!current || current.is('body')) break;
            }
            
            // Clean up: "BXH Ngoại hạng Anh (Vòng 31)" -> "Ngoại hạng Anh"
            if (heading) {
                heading = heading.replace(/^BXH\s+/i, '').replace(/\s*\(.*\)$/, '').trim();
            } else {
                heading = `Giải đấu ${i+1}`;
            }

            // Extract 5 recent matches
            // It's the last column, looking for spans with title or text like H(Hoa), T(Thang), B(Bai)
            const row1 = table.find('tbody tr, tr').eq(1);
            const cols = row1.find('td');
            const recentForms = [];
            const lastCol = cols.last();
            lastCol.find('span').each((_, span) => {
                const text = $(span).text().trim().toLowerCase();
                const bg = $(span).attr('class');
                if (bg && bg.includes('bggreen')) recentForms.push('W');
                else if (bg && bg.includes('bgred')) recentForms.push('L');
                else if (bg && bg.includes('bgyelow')) recentForms.push('D');
                else if (text === 't') recentForms.push('W');
                else if (text === 'h') recentForms.push('D');
                else if (text === 'b') recentForms.push('L');
            });

            console.log(`Table ${i+1}: Found Heading -> "${heading}", Recent Form Ex: [${recentForms.join('-')}]`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}
test();
