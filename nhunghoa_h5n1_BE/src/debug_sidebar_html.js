const cheerio = require('cheerio');
const fs = require('fs');

function dumpSidebar() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    console.log('--- Sidebar-Left HTML ---');
    console.log($('.sidebar-left').html());
}

dumpSidebar();
