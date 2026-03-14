const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
const $ = cheerio.load(html);

console.log("Looking for tables...");
$('table').each((i, tableNode) => {
    const table = $(tableNode);
    let heading = '';
    
    // Attempt 1: Closest section-content
    let section = table.closest('.section-content');
    if (section.length > 0) {
        let h2Link = section.find('h2.title-bxh a, h2 a, h3 a');
        if (h2Link.length > 0) {
            heading = h2Link.text().trim();
        } else {
            heading = section.find('h2.title-bxh, h2, h3').first().text().trim();
        }
        console.log(`Table ${i}: section-content found. Heading = ${heading}`);
    } else {
        // Attempt 2: Traverse previous siblings
        let current = table;
        for (let level = 0; level < 5; level++) {
            const prev = current.prev();
            if (prev.length > 0) {
                if (prev.is('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate')) {
                    heading = prev.text().trim();
                    break;
                }
                const hInner = prev.find('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate');
                if (hInner.length > 0) {
                    heading = hInner.first().text().trim();
                    break;
                }
            }
            current = current.parent();
            if (!current || current.is('body')) break;
        }
        console.log(`Table ${i}: no section-content. Traversed previous. Heading = ${heading}`);
        if (!heading) {
            // Print the immediate parent structure to understand
            console.log(`  --> Parent: ${table.parent().prop('tagName')} class='${table.parent().attr('class')}' id='${table.parent().attr('id')}'`);
            console.log(`  --> Prev sibling: ${table.prev().prop('tagName')} class='${table.prev().attr('class')}'`);
        }
    }
});
