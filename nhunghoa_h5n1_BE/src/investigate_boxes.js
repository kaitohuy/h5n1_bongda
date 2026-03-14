const cheerio = require('cheerio');
const fs = require('fs');

function investigateBoxes() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);

    console.log('--- Investigating all potential boxes ---');
    $('div').each((i, div) => {
        const className = $(div).attr('class');
        if (className && (className.includes('box') || className.includes('menu') || className.includes('cate'))) {
            const title = $(div).find('h2, h3, .title, .title-box, .title-cate').first().text().trim();
            if (title) {
                console.log(`Div ${i}: Class=[${className}] Title=[${title}]`);
            }
        }
    });
}

investigateBoxes();
