const cheerio = require('cheerio');
const fs = require('fs');

function dumpMList() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    console.log('--- m-list example ---');
    const mlist = $('.m-list').first();
    console.log(mlist.html());
}

dumpMList();
