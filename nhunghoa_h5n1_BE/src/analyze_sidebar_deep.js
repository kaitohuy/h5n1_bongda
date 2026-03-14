const cheerio = require('cheerio');
const fs = require('fs');

function analyzeSidebarDeep() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    console.log('--- Sidebar Boxes (.sidebar > div) ---');
    $('.sidebar > div').each((i, div) => {
        const className = $(div).attr('class');
        const text = $(div).text().trim();
        console.log(`Box ${i}: [${className}] -> ${text.substring(0, 50)}...`);
    });

}

analyzeSidebarDeep();
