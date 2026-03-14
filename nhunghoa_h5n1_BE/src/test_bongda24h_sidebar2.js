const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
const $ = cheerio.load(html);

// Find elements with class containing 'left' or 'menu' that also contain lists 'ul'
$('*').each((i, el) => {
    const className = $(el).attr('class') || '';
    if ((className.includes('left') || className.includes('menu')) && $(el).find('ul, li').length > 0) {
        // Let's print the first 200 chars to see if it's our menu
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.includes('GIẢI NỔI BẬT') || text.includes('Ngoại hạng Anh')) {
            console.log("Class:", className);
            console.log("Content start:", text.substring(0, 150));
        }
    }
});
