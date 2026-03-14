const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
const $ = cheerio.load(html);

$('table').each((i, tableNode) => {
    const table = $(tableNode);
    let heading = '';
    
    let current = table;
    while(current.length > 0) {
        // Search previous siblings for a heading
        const prevs = current.prevAll('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate');
        if (prevs.length > 0) {
            heading = prevs.first().text().trim();
            break;
        }
        
        // Also check if any previous sibling *contains* the heading (if it's wrapped in a div)
        let found = false;
        current.prevAll().each((_, sibling) => {
            const h = $(sibling).find('h2, h3, .title-bxh, .title-box, .title-cate');
            if (h.length > 0) {
                heading = h.first().text().trim();
                found = true;
                return false; // break loop
            }
        });
        if (found) break;

        current = current.parent();
        if (current.is('body') || current.hasClass('section-content')) break;
    }
    
    heading = heading.replace(/^BXH\s+/i, '').replace(/\s*\(.*\)$/, '').trim();
    console.log(`Table ${i} Heading: ${heading}`);
});
