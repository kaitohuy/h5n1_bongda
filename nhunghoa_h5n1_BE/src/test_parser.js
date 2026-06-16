const cheerio = require('cheerio');

function cleanHtml(htmlStr) {
    if (!htmlStr) return '';
    return htmlStr.replace(/href="\//g, 'href="https://bongda24h.vn/')
                  .replace(/src="\//g, 'src="https://bongda24h.vn/');
}

async function testMultiTable(url, label) {
    console.log(`\n=== Testing Dynamic Parser for ${label} ===`);
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const parsedTables = [];
    $('table').each((i, tableNode) => {
        const table = $(tableNode);
        
        // Skip non-standings tables
        if (table.hasClass('table-ltd-football') || table.hasClass('table-tktt') || table.hasClass('table-dtnb') || table.hasClass('table-wcp')) {
            return;
        }

        // 1. Determine title and header rows
        let title = '';
        let headerRow = null;
        let isCombinedHeader = false;

        const firstRow = table.find('tr').first();
        const firstRowThs = firstRow.find('th, td');
        const firstCell = firstRowThs.first();
        
        if (firstCell.attr('colspan') === '2' || firstCell.attr('colspan') === 2) {
            // Combined title/header row (like WC group stage)
            title = firstCell.text().trim();
            headerRow = firstRow;
            isCombinedHeader = true;
        } else {
            // Separate title row (like Asian qualifiers)
            // The first row is the title, the second row is the header
            title = firstCell.text().trim();
            headerRow = table.find('tr').eq(1);
        }

        if (!title) {
            let current = table;
            while(current.length > 0) {
                const prevs = current.prevAll('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate');
                if (prevs.length > 0) {
                    title = prevs.first().text().trim();
                    break;
                }
                current = current.parent();
                if (current.is('body')) break;
            }
        }
        if (!title) title = `Bảng ${i + 1}`;
        title = title.replace(/\s+/g, ' ').trim();

        // 2. Define column indexes
        let colMap = {};
        if (isCombinedHeader) {
            // Combined format: Rank is 0, Team is 1, Played is 2, Won is 3, Drawn is 4, Lost is 5, GD is 7, Points is 8, Form is 9
            colMap = { rank: 0, team: 1, played: 2, won: 3, drawn: 4, lost: 5, gd: 7, points: 8, form: 9 };
        } else {
            // Standard format: parse from header cells
            const headers = [];
            headerRow.find('th, td').each((_, cell) => {
                headers.push($(cell).text().trim().toLowerCase());
            });

            colMap = {
                rank: headers.findIndex(h => h === '#' || h === 'tt'),
                team: headers.findIndex(h => h === 'đội' || h.includes('đội')),
                played: headers.findIndex(h => h === 'st' || h === 'trận'),
                won: headers.findIndex(h => h === 't' || h === 'w' || h === 'thắng'),
                drawn: headers.findIndex(h => h === 'h' || h === 'd' || h === 'hòa'),
                lost: headers.findIndex(h => h === 'b' || h === 'l' || h === 'bại' || h === 'thua'),
                gd: headers.findIndex(h => h === 'hs' || h === '+/-'),
                points: headers.findIndex(h => h === 'đ' || h === 'điểm' || h === 'pts'),
                form: headers.findIndex(h => h.includes('gần nhất') || h.includes('form'))
            };

            if (colMap.rank === -1) colMap.rank = 0;
            if (colMap.team === -1) colMap.team = 1;
            if (colMap.played === -1) colMap.played = 2;
            if (colMap.won === -1) colMap.won = 3;
            if (colMap.drawn === -1) colMap.drawn = 4;
            if (colMap.lost === -1) colMap.lost = 5;
            if (colMap.gd === -1) colMap.gd = 6;
            if (colMap.points === -1) colMap.points = 7;
            if (colMap.form === -1) colMap.form = 8;
        }

        // 3. Extract team rows
        let teams = [];
        table.find('tr').each((rowIdx, tr) => {
            const cols = $(tr).find('td');
            if (cols.length < 5) return;
            
            // Skip headers/title rows
            const firstCellText = cols.first().text().trim();
            if (firstCellText === title || firstCellText.toLowerCase() === 'tt' || firstCellText.toLowerCase() === '#') {
                return;
            }

            const rank = $(cols[colMap.rank]).text().trim();
            const teamCol = $(cols[colMap.team]);
            const teamName = teamCol.find('a').last().text().trim() || teamCol.text().trim();
            
            // Extract logo
            let logo = '';
            const img = teamCol.find('img');
            const source = teamCol.find('source').first();
            let possibleSources = [
                source.attr('srcset'),
                source.attr('data-srcset'),
                img.attr('data-src'),
                img.attr('data-original'),
                img.attr('src')
            ];
            for (let src of possibleSources) {
                if (src && src.startsWith('http') && !src.includes('data:image')) {
                    logo = src.split(',').pop().trim().split(' ')[0];
                    break;
                }
            }
            if (logo && logo.startsWith('/')) logo = 'https://bongda24h.vn' + logo;

            const played = $(cols[colMap.played]).text().trim();
            const won = $(cols[colMap.won]).text().trim();
            const drawn = $(cols[colMap.drawn]).text().trim();
            const lost = $(cols[colMap.lost]).text().trim();
            const gd = $(cols[colMap.gd]).text().trim();
            const points = $(cols[colMap.points]).text().trim();

            // Form parsing
            const forms = [];
            const formCol = $(cols[colMap.form]);
            
            // Try image-based form (for WC page)
            const formImgs = formCol.find('img');
            if (formImgs.length > 0) {
                formImgs.each((_, imgNode) => {
                    const alt = $(imgNode).attr('alt') || '';
                    if (alt.includes('Thắng') || alt.includes('Thắng')) forms.push('W');
                    else if (alt.includes('Hòa') || alt.includes('Hòa')) forms.push('D');
                    else if (alt.includes('Thua')) forms.push('L');
                });
            } else {
                // Try span-based form (for qualifier page)
                formCol.find('span').each((_, span) => {
                    const bg = $(span).attr('class') || '';
                    if (bg.includes('bggreen')) forms.push('W');
                    else if (bg.includes('bgred')) forms.push('L');
                    else if (bg.includes('bgyelow') || bg.includes('bgorange')) forms.push('D');
                });
            }

            if (teamName && teamName !== 'Đội') {
                teams.push({ rank, teamName, logo, played, won, drawn, lost, gd, points, form: forms });
            }
        });

        if (teams.length > 0) {
            parsedTables.push({ title, teams });
        }
    });

    console.log(`Extracted ${parsedTables.length} tables!`);
    parsedTables.forEach((t, idx) => {
        console.log(`Table ${idx+1}: "${t.title}" with ${t.teams.length} teams.`);
        if (t.teams.length > 0) {
            console.log(`  First team: ${t.teams[0].rank}. ${t.teams[0].teamName} - P:${t.teams[0].played} W:${t.teams[0].won} D:${t.teams[0].drawn} L:${t.teams[0].lost} GD:${t.teams[0].gd} PTS:${t.teams[0].points} Form:${t.teams[0].form.join(',')}`);
        }
    });
}

async function run() {
    await testMultiTable('https://bongda24h.vn/vck-world-cup/bang-xep-hang-41.html', 'WC Group Stage');
    await testMultiTable('https://bongda24h.vn/vong-loai-world-cup-khu-vuc-chau-a/bang-xep-hang-82.html', 'WC Asian Qualifiers');
}
run();
