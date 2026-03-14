const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('src/bongda24h_bxh.html', 'utf8');
const $ = cheerio.load(html);

$('table').each((i, tableNode) => {
    const table = $(tableNode);
    // Try to find EPL table
    if (table.find('td').text().includes('Man City') || i === 0) {
        console.log(`--- TABLE ${i} SURROUNDINGS ---`);
        console.log('TABLE HTML length:', $.html(table).length);
        
        let nextSiblings = table.nextAll();
        console.log(`Found ${nextSiblings.length} next siblings.`);
        nextSiblings.each((j, sib) => {
            if (j > 5) return;
            console.log(`Sibling ${j}: <${sib.tagName}> classes: "${$(sib).attr('class')}" text: "${$(sib).text().trim().substring(0, 30)}"`);
        });

        let parentNextSiblings = table.parent().nextAll();
        console.log(`Found ${parentNextSiblings.length} parent next siblings.`);
        parentNextSiblings.each((j, sib) => {
            if (j > 5) return;
            console.log(`Parent Sibling ${j}: <${sib.tagName}> classes: "${$(sib).attr('class')}" text: "${$(sib).text().trim().substring(0, 30)}"`);
        });
    }
});






