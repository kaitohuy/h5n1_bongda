const fs = require('fs');
const cheerio = require('cheerio');

async function test() {
    try {
        const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
        const $ = cheerio.load(html);

        const tables = $('table');
        console.log("Total tables found:", tables.length);
        
        // Inspect the first table's siblings or parent to find the league name
        if (tables.length > 0) {
            const table1 = $(tables[0]);
            
            // Go up the DOM tree and find a heading
            const parentClass = table1.parent().attr('class');
            console.log("Table parent class:", parentClass);
            
            // Find preceding headings
            // The structure is usually <div class="title-cate"><a title="...">Ngoại Hạng Anh</a></div>
            let current = table1;
            for(let i=0; i<3; i++) {
                current = current.parent();
                console.log(`Parent level ${i+1} class: ${current.attr('class')}, id: ${current.attr('id')}`);
            }
            
            // Try to find the closest link or header that looks like a league name
            // Let's just print the text of `.title-cate` or similar if it exists
            const headings = $('.title-box h2, .title-cate h2, .box-title h2, .title-bxh, h2, h3');
            console.log("Headings found:", headings.length);
            for(let i=0; i<Math.min(5, headings.length); i++) {
                console.log(`Heading ${i}:`, $(headings[i]).text().trim());
            }

            // Print the first row's HTML to see how the team name/logo is structured
            console.log("Row 1 HTML:", table1.find('tr').eq(1).html());
        }
        
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
