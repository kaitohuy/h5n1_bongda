const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
const $ = cheerio.load(html);

console.log("Parsing Categories...");

// 1. First, build a map from League URL/Name to Category Name
let catMap = {};
$('.menu-main-all .box').each((i, box) => {
    let title = $(box).find('.title-box, .title').text().trim();
    if (title.toUpperCase().includes('KHU VỰC')) {
        title = title.replace(/KHU VỰC/i, '').trim();
    }
    
    $(box).find('ul li a').each((j, a) => {
        const leagueText = $(a).text().trim();
        const href = $(a).attr('href');
        // Both by Name and by URL for robustness
        catMap[leagueText] = title;
        if(href) catMap[href] = title;
    });
});

console.log(catMap);

// 2. Iterate over tables and apply the category
$('table').each((i, tableNode) => {
    const table = $(tableNode);
    let heading = '';
    
    let section = table.closest('.section-content');
    if (section.length > 0) {
        let h2Link = section.find('h2.title-bxh a, h2 a, h3 a');
        if (h2Link.length > 0) {
            heading = h2Link.text().trim();
        } else {
            heading = section.find('h2.title-bxh, h2, h3').first().text().trim();
        }
    }
    
    if (!heading) {
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
    }
    if (!heading) heading = `Giải đấu ${i+1}`;
    
    // Clean up: "BXH Ngoại hạng Anh (Vòng 31)" -> "Ngoại hạng Anh"
    heading = heading.replace(/^BXH\s+/i, '').replace(/\s*\(.*\)$/, '').trim();
    if (i === 0 && heading === 'Giải đấu 1') heading = 'Ngoại hạng Anh';

    // Find category
    let category = catMap[heading] || 'GIẢI NỔI BẬT'; // Default to prominent
    
    console.log(`Table ${i} -> League: ${heading} | Category: ${category}`);
});
