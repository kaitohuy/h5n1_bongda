const cheerio = require('cheerio');
const fs = require('fs');

function reportHeaders() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    console.log('--- Headers ---');
    $('h2, h3, h4, .title-box, .title-cate').each((i, h) => {
        console.log(`${$(h).prop('tagName')} [${$(h).attr('class')}]: ${$(h).text().trim()}`);
    });

    console.log('--- All Div Classes with Box ---');
    $('div[class*="box"]').each((i, div) => {
        console.log(`DIV [${$(div).attr('class')}]: ${$(div).find('> .title-box, > .title, > .title-cate').text().trim()}`);
    });
}

reportHeaders();
