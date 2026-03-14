const cheerio = require('cheerio');
const fs = require('fs');

function debugNavigationDeep() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    console.log('--- Deep Check Item 0 ---');
    const firstMList = $('.m-list').first();
    console.log('Outer HTML of first .m-list:');
    // console.log($.html(firstMList)); // Too much output maybe
    
    const title = firstMList.find('.m-title').text().trim();
    console.log('Title:', title);
    
    const links = firstMList.find('a');
    console.log(`Found ${links.length} total anchors inside .m-list`);
    links.each((i, a) => {
        console.log(`Link ${i}: ${$(a).text().trim()} -> ${$(a).attr('href')}`);
    });

}

debugNavigationDeep();
