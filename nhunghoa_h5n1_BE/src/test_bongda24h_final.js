const fs = require('fs');
const cheerio = require('cheerio');

async function test() {
    try {
        const html = fs.readFileSync('bongda24h_bxh.html', 'utf-8');
        const $ = cheerio.load(html);

        let leagues = [];

        // Every table belongs to a league. Bongda24h usually places <h2> with title right above the .table-content or .table-scrol-x
        $('table').each((i, tableNode) => {
            const table = $(tableNode);
            // Try to find the heading above this table
            // Usually it's in a preceding sibling or parent's preceding sibling
            let heading = '';
            
            // Go up until we find .section-content or similar, then find h2
            let section = table.closest('.section-content');
            if (section.length > 0) {
                heading = section.find('h2.title-bxh, h2, h3').first().text().trim();
            }
            if (!heading) {
                // Try parent's preceding
                heading = table.parent().prev().find('h2').text().trim() || table.parent().parent().prev().find('h2').text().trim();
            }
            if (!heading) {
                heading = table.closest('article').find('.tieude-bxh').text().trim();
            }
            if (!heading) heading = `Giải đấu ${i+1}`;
            
            // Clean heading e.g. "BXH Ngoại hạng Anh (Vòng 31)" -> "Ngoại hạng Anh"
            heading = heading.replace(/^BXH\s+/i, '').replace(/\s*\(.*\)$/, '').trim();

            const headers = [];
            table.find('thead th, tr').first().find('th, td').each((j, th) => {
                headers.push($(th).text().trim().toLowerCase());
            });

            const colMap = {
                rank: headers.findIndex(h => h === '#' || h === 'tt'),
                team: headers.findIndex(h => h === 'đội'),
                played: headers.findIndex(h => h === 'st' || h === 'trận'),
                won: headers.findIndex(h => h === 't' || h === 'thua' || h === 'w'),
                drawn: headers.findIndex(h => h === 'h' || h === 'hòa' || h === 'd'),
                lost: headers.findIndex(h => h === 'b' || h === 'thua' || h === 'l'),
                gd: headers.findIndex(h => h === 'hs' || h === '+/-'),
                points: headers.findIndex(h => h === 'đ' || h === 'điểm' || h === 'pts')
            };

            // If we couldn't find points by header, fallback to hardcoded indexes
            const hasHeader = colMap.points !== -1;

            let teams = [];
            table.find('tbody tr, tr').each((j, tr) => {
                // skip header row if it's in tbody or first row
                if ($(tr).find('th').length > 0) return;
                
                const cols = $(tr).find('td');
                if (cols.length < 5) return;

                let rank, teamName, logo, played, won, drawn, lost, gd, points;
                
                if (hasHeader && cols.length === headers.length) {
                    rank = $(cols[colMap.rank]).text().trim();
                    const teamCol = $(cols[colMap.team]);
                    teamName = teamCol.find('a').attr('title') || teamCol.text().trim();
                    logo = teamCol.find('img').attr('src');
                    played = $(cols[colMap.played]).text().trim();
                    won = $(cols[colMap.won]).text().trim();
                    drawn = $(cols[colMap.drawn]).text().trim();
                    lost = $(cols[colMap.lost]).text().trim();
                    gd = $(cols[colMap.gd]).text().trim();
                    points = $(cols[colMap.points]).text().trim();
                } else {
                    // Fallback to exactly what we observed in row 1
                    rank = $(cols[0]).text().trim();
                    const teamCol = $(cols[1]);
                    teamName = teamCol.find('a').attr('title') || teamCol.text().trim();
                    logo = teamCol.find('img').attr('src');
                    played = $(cols[2]).text().trim();
                    won = $(cols[3]).text().trim();
                    drawn = $(cols[4]).text().trim();
                    lost = $(cols[5]).text().trim();
                    // if length is 9, 6 is gd, 7 is points
                    if (cols.length === 9) {
                        gd = $(cols[6]).text().trim();
                        points = $(cols[7]).text().trim();
                    } else if (cols.length >= 10) {
                        gd = $(cols[8]).text().trim();
                        points = $(cols[9]).text().trim();
                    }
                }
                
                if (teamName) {
                    teams.push({ rank, teamName, logo, played, won, drawn, lost, gd, points });
                }
            });

            if (teams.length > 0) {
                leagues.push({ leagueName: heading, teams });
            }
        });
        
        console.log("Found", leagues.length, "leagues.");
        if (leagues.length > 0) {
            console.log("First league:", leagues[0].leagueName);
            console.log("Top 2 teams:", JSON.stringify(leagues[0].teams.slice(0, 2), null, 2));
        }

    } catch(e) {
        console.error("Error:", e);
    }
}
test();
