const cheerio = require('cheerio');
const fs = require('fs');

function findNavigationLinks() {
    const html = fs.readFileSync('src/debug_full_page.html', 'utf8');
    const $ = cheerio.load(html);
    
    console.log('--- Links containing "bảng xếp hạng" ---');
    $('a').each((i, a) => {
        const text = $(a).text().trim().toLowerCase();
        if (text.includes('bảng xếp hạng') || text.includes('bxh')) {
            console.log(`Link ${i}: [${$(a).text().trim()}] -> ${$(a).attr('href')}`);
            // In cả class của phần tử cha để tìm selector
            console.log(`  Parent: ${$(a).parent().prop('tagName')}.${$(a).parent().attr('class')}`);
            console.log(`  Grand-Parent: ${$(a).parent().parent().prop('tagName')}.${$(a).parent().parent().attr('class')}`);
        }
    });

    console.log('--- Sidebar-Left Content ---');
    $('.sidebar-left, .left-menu, #left, .menu-left').each((i, el) => {
        console.log(`Sidebar Found! tag=${$(el).prop('tagName')} class=${$(el).attr('class')}`);
        console.log($(el).text().substring(0, 500));
    });
}

findNavigationLinks();
