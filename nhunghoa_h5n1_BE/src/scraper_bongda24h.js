/**
 * scraper_bongda24h.js — Bongda24h Leaderboard (Bảng Xếp Hạng) scraper
 */

const cheerio = require('cheerio');

const BONGDA24H_URL = 'https://bongda24h.vn/bang-xep-hang.html';

// ── Cache ─────────────────────────────────────────────────────────────────────
let standingsCache = { data: null, expiresAt: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchFifaRankings() {
    const FIFA_URL = 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html';
    try {
        const res = await fetch(FIFA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Tìm thông tin Thứ hạng Việt Nam
        let vnRankText = '';
        const vnLabel = $('strong, p, div, span').filter((i, el) => {
            const children = $(el).children();
            return children.length <= 2 && $(el).text().includes('Thứ hạng Việt Nam:');
        }).first();
        
        if (vnLabel.length) {
            vnRankText = vnLabel.text().trim();
        }

        const table = $('table').first();
        if (!table.length) return null;

        let teams = [];
        let vnFoundRank = '';

        table.find('tbody tr, tr').each((i, tr) => {
            if (i === 0) return; // Skip header
            const cols = $(tr).find('td');
            if (cols.length < 5) return;

            const rank = $(cols[0]).text().trim();
            const teamCol = $(cols[1]);
            const teamName = teamCol.find('a').last().text().trim() || teamCol.text().trim();
            
            // Tối ưu lấy logo: Tìm trong source srcset trước (cơ chế picture/lazyload)
            let logo = '';
            
            // Thử lấy từ các thuộc tính tiêu chuẩn
            const img = teamCol.find('img');
            const source = teamCol.find('source').first();
            
            let possibleSources = [
                source.attr('srcset'),
                source.attr('data-srcset'),
                img.attr('data-src'),
                img.attr('data-original'),
                img.attr('src')
            ];

            // Brute force tìm URL ảnh thật sự trong HTML nếu các thuộc tính trên dính base64 hoặc placeholder
            for (let src of possibleSources) {
                if (src && src.startsWith('http') && !src.includes('data:image')) {
                    if (src.includes(',')) {
                        logo = src.split(',').pop().trim().split(' ')[0];
                    } else {
                        logo = src.split(' ')[0];
                    }
                    if (logo.includes('.png') || logo.includes('.jpg') || logo.includes('.webp')) break;
                }
            }

            // Nếu vẫn chưa có logo thật, dùng regex quét toàn bộ HTML ô đó
            if (!logo || logo.includes('data:image')) {
                const html = teamCol.html() || '';
                const match = html.match(/https?:\/\/[^\"\s>]+\.(?:png|jpg|jpeg|webp|gif)/i);
                if (match) logo = match[0];
            }

            if (logo && logo.startsWith('/')) logo = 'https://bongda24h.vn' + logo;
            if (logo && logo.includes('data:image')) logo = ''; 

            const points = $(cols[2]).text().trim();
            const pointsBefore = $(cols[3]).text().trim();
            const gd = $(cols[4]).text().trim(); // +/- 
            const region = $(cols[5]).text().trim(); // Khu vực

            if (teamName) {
                teams.push({
                    rank,
                    teamName,
                    logo,
                    played: pointsBefore, // Gán điểm trước vào cột played (Frontend hiển thị đúng)
                    won: '-',
                    drawn: '-',
                    lost: '-',
                    gd,
                    points,
                    region, 
                    form: []
                });
                if (teamName.toLowerCase().includes('việt nam')) {
                    vnFoundRank = rank;
                }
            }
        });

        // Nếu không tìm thấy text từ web hiển thị, tự tạo từ data table
        if ((!vnRankText || vnRankText.length > 100) && vnFoundRank) {
            vnRankText = `Thứ hạng Việt Nam: ${vnFoundRank}`;
        }
        

        return {
            leagueName: 'Bảng xếp hạng FIFA',
            category: 'BXH FIFA',
            teams,
            fullUrl: FIFA_URL,
            vnRank: vnRankText,
            isSpecialized: true // Đánh dấu dữ liệu được trích xuất chuyên sâu
        };
    } catch (e) {
        console.error('[bongda24h] fetchFifaRankings failed:', e.message);
        return null;
    }
}

async function fetchFromBongda24h() {
    try {
        // Lấy BXH FIFA trước
        const fifaRanking = await fetchFifaRankings();

        const res = await fetch(BONGDA24H_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;'
            }
        });
        
        if (!res.ok) throw new Error(`Bongda24h fetch failed: ${res.status}`);
        
        const html = await res.text();
        const $ = cheerio.load(html);

        let leagues = [];
        if (fifaRanking) leagues.push(fifaRanking);

        let navigation = [];
        // Thêm FIFA vào đầu navigation
        navigation.push({
            name: 'FIFA',
            leagues: [{ name: 'BXH FIFA Nam', fullUrl: 'https://bongda24h.vn/bang-xep-hang-fifa-nam.html' }]
        });

        let catMap = {};

        // 1. Xây dựng Navigation và catMap từ .m-list (Giao diện mới)
        $('.m-list').each((i, el) => {
            const regionName = $(el).find('.m-title').first().text().trim();
            if (regionName) {
                let regionItem = { name: regionName, leagues: [] };
                $(el).find('.m-sub a, a').each((j, a) => {
                    const leagueName = $(a).text().trim();
                    let href = $(a).attr('href');
                    if (leagueName && href && !$(a).hasClass('m-title')) {
                        if (href.startsWith('/')) href = 'https://bongda24h.vn' + href;
                        regionItem.leagues.push({ name: leagueName, fullUrl: href });
                        catMap[leagueName] = regionName;
                        catMap[href] = regionName;
                    }
                });
                if (regionItem.leagues.length > 0) {
                    navigation.push(regionItem);
                }
            }
        });

        // 2. Dự phòng: Nếu navigation trống, thử cấu trúc cũ
        if (navigation.length === 0) {
            $('.menu-main-all .box, .sidebar-left .box, .left-menu .box, .box-cate').each((i, box) => {
                let boxTitle = $(box).find('.title-box, .title, .title-cate').first().text().trim();
                if (boxTitle.toUpperCase() === 'KHU VỰC') {
                    $(box).find('ul > li').each((j, li) => {
                        const regionA = $(li).find('> a');
                        const regionName = regionA.text().trim();
                        if (regionName) {
                            let regionItem = { name: regionName, leagues: [] };
                            $(li).find('ul.sub li a, ul li a').each((k, subA) => {
                                const subText = $(subA).text().trim();
                                let subHref = $(subA).attr('href');
                                if (subText && subText !== regionName) {
                                    if (subHref && subHref.startsWith('/')) subHref = 'https://bongda24h.vn' + subHref;
                                    regionItem.leagues.push({ name: subText, fullUrl: subHref });
                                    catMap[subText] = regionName;
                                }
                            });
                            if (regionItem.leagues.length > 0) navigation.push(regionItem);
                        }
                    });
                }
            });
        }

        // 3. Trích xuất dữ liệu Bảng xếp hạng từ các thẻ table
        $('table').each((i, tableNode) => {
            const table = $(tableNode);
            let heading = '';
            
            // Tìm tiêu đề bảng (Hỗ trợ nhiều cấu trúc)
            let current = table;
            while(current.length > 0) {
                const prevs = current.prevAll('h2, h3, .title-bxh, .tieude-bxh, .title-box, .title-cate');
                if (prevs.length > 0) {
                    heading = prevs.first().text().trim();
                    break;
                }
                let found = false;
                current.prevAll().each((_, sibling) => {
                    const h = $(sibling).find('h2, h3, .title-bxh, .title-box, .title-cate');
                    if (h.length > 0) {
                        heading = h.first().text().trim();
                        found = true;
                        return false; 
                    }
                });
                if (found) break;
                current = current.parent();
                if (current.is('body') || current.hasClass('section-content')) break;
            }
            if (!heading) heading = `Giải đấu ${i+1}`;
            
            heading = heading.replace(/^BXH\s+/i, '').replace(/\s*\(.*\)$/, '').trim();
            
            // Map danh mục
            let category = catMap[heading] || 'Khu vực khác';
            const prominentLeagues = ['Ngoại hạng Anh', 'Cúp C1', 'Cúp C2', 'V-League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];
            if (prominentLeagues.some(l => heading.includes(l))) category = 'GIẢI NỔI BẬT';

            // Phân tích Header
            const headers = [];
            table.find('thead th, tr').first().find('th, td').each((j, th) => {
                headers.push($(th).text().trim().toLowerCase());
            });

            const colMap = {
                rank: headers.findIndex(h => h === '#' || h === 'tt'),
                team: headers.findIndex(h => h === 'đội'),
                played: headers.findIndex(h => h === 'st' || h === 'trận'),
                won: headers.findIndex(h => h === 't' || h === 'thua' || h === 'w' || h === 'thắng'),
                drawn: headers.findIndex(h => h === 'h' || h === 'hòa' || h === 'd'),
                lost: headers.findIndex(h => h === 'b' || h === 'thua' || h === 'l' || h === 'bại'),
                gd: headers.findIndex(h => h === 'hs' || h === '+/-'),
                points: headers.findIndex(h => h === 'đ' || h === 'điểm' || h === 'pts')
            };

            const hasHeader = colMap.points !== -1;
            let teams = [];
            
            table.find('tbody tr, tr').each((j, tr) => {
                if ($(tr).find('th').length > 0) return; 
                const cols = $(tr).find('td');
                if (cols.length < 5) return;

                let rank, teamName, logo, played, won, drawn, lost, gd, points;
                let forms = [];
                
                if (hasHeader && cols.length === headers.length) {
                    rank = $(cols[colMap.rank]).text().trim();
                    const teamCol = $(cols[colMap.team]);
                    teamName = teamCol.find('a').attr('title') || teamCol.text().trim();
                    logo = teamCol.find('img').attr('src') || '';
                    played = $(cols[colMap.played]).text().trim();
                    won = $(cols[colMap.won]).text().trim();
                    drawn = $(cols[colMap.drawn]).text().trim();
                    lost = $(cols[colMap.lost]).text().trim();
                    gd = $(cols[colMap.gd]).text().trim();
                    points = $(cols[colMap.points]).text().trim();
                } else {
                    rank = $(cols[0]).text().trim();
                    const teamCol = $(cols[1]);
                    teamName = teamCol.find('a').attr('title') || teamCol.text().trim();
                    logo = teamCol.find('img').attr('src') || '';
                    played = $(cols[2]).text().trim();
                    won = $(cols[3]).text().trim();
                    drawn = $(cols[4]).text().trim();
                    lost = $(cols[5]).text().trim();
                    if (cols.length === 9) {
                        gd = $(cols[6]).text().trim();
                        points = $(cols[7]).text().trim();
                    } else if (cols.length >= 10) {
                        gd = $(cols[8]).text().trim();
                        points = $(cols[9]).text().trim();
                    }
                }
                
                // Form
                const lastCol = cols.last();
                lastCol.find('span').each((_, span) => {
                    const bg = $(span).attr('class') || '';
                    if (bg.includes('bggreen')) forms.push('W');
                    else if (bg.includes('bgred')) forms.push('L');
                    else if (bg.includes('bgyelow')) forms.push('D');
                });
                
                if (teamName) {
                    if (logo && logo.startsWith('/')) logo = 'https://bongda24h.vn' + logo;
                    teams.push({ rank, teamName, logo, played, won, drawn, lost, gd, points, form: forms });
                }
            });

            // Tìm Link Xem Đầy Đủ
            let fullUrl = '';
            let nextA = table.nextAll('.link-xem, .more-club').find('a').first();
            if (!nextA.length) nextA = table.parent().nextAll('.link-xem, .more-club').find('a').first();
            if (nextA.length) {
                fullUrl = nextA.attr('href');
                if (fullUrl && fullUrl.startsWith('/')) fullUrl = 'https://bongda24h.vn' + fullUrl;
            }

            if (teams.length > 0) {
                const existingIdx = leagues.findIndex(l => l.leagueName === heading || (l.category === 'BXH FIFA' && heading.includes('FIFA')));
                if (existingIdx !== -1) {
                    // TUYỆT ĐỐI không ghi đè nếu đã có dữ liệu chuyên sâu (isSpecialized)
                    if (leagues[existingIdx].isSpecialized) {
                        return;
                    }
                    if (teams.length > leagues[existingIdx].teams.length) {
                        leagues[existingIdx] = { leagueName: heading, category, teams, fullUrl };
                    }
                } else {
                    leagues.push({ leagueName: heading, category, teams, fullUrl });
                }
            }
        });

        return { leagues, navigation };

    } catch (e) {
        console.error('[bongda24h] fetchFromBongda24h failed:', e.message);
        throw e;
    }
}

async function fetchDetailedStandings(url) {
    if (!url) return null;
    if (url.startsWith('/')) url = 'https://bongda24h.vn' + url;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;'
            }
        });
        if (!res.ok) throw new Error(`Detailed fetch failed: ${res.status}`);
        const html = await res.text();
        const $ = cheerio.load(html);
        const table = $('table').first();
        if (!table.length) return null;
        
        // Similar extraction logic for detailed view
        const headers = [];
        table.find('thead th, tr').first().find('th, td').each((j, th) => {
            headers.push($(th).text().trim().toLowerCase());
        });
        const colMap = {
            rank: headers.findIndex(h => h === '#' || h === 'tt'),
            team: headers.findIndex(h => h === 'đội'),
            played: headers.findIndex(h => h === 'st' || h === 'trận'),
            won: headers.findIndex(h => h === 't' || h === 'thua' || h === 'w' || h === 'thắng'),
            drawn: headers.findIndex(h => h === 'h' || h === 'hòa' || h === 'd'),
            lost: headers.findIndex(h => h === 'b' || h === 'thua' || h === 'l' || h === 'bại'),
            gd: headers.findIndex(h => h === 'hs' || h === '+/-'),
            points: headers.findIndex(h => h === 'đ' || h === 'điểm' || h === 'pts')
        };

        let teams = [];
        table.find('tbody tr, tr').each((j, tr) => {
            if ($(tr).find('th').length > 0) return; 
            const cols = $(tr).find('td');
            if (cols.length < 5) return;
            let rank = $(cols[colMap.rank !== -1 ? colMap.rank : 0]).text().trim();
            const teamCol = $(cols[colMap.team !== -1 ? colMap.team : 1]);
            const teamName = teamCol.find('a').attr('title') || teamCol.text().trim();
            let logo = teamCol.find('img').attr('src') || '';
            if (logo && logo.startsWith('/')) logo = 'https://bongda24h.vn' + logo;
            const played = $(cols[colMap.played !== -1 ? colMap.played : 2]).text().trim();
            const won = $(cols[colMap.won !== -1 ? colMap.won : 3]).text().trim();
            const drawn = $(cols[colMap.drawn !== -1 ? colMap.drawn : 4]).text().trim();
            const lost = $(cols[colMap.lost !== -1 ? colMap.lost : 5]).text().trim();
            let gdIdx = colMap.gd !== -1 ? colMap.gd : (cols.length === 9 ? 6 : 8);
            let ptsIdx = colMap.points !== -1 ? colMap.points : (cols.length === 9 ? 7 : 9);
            const gd = $(cols[gdIdx]).text().trim();
            const points = $(cols[ptsIdx]).text().trim();
            let forms = [];
            cols.last().find('span').each((_, span) => {
                const bg = $(span).attr('class') || '';
                if (bg.includes('bggreen')) forms.push('W');
                else if (bg.includes('bgred')) forms.push('L');
                else if (bg.includes('bgyelow')) forms.push('D');
            });
            if (teamName) teams.push({ rank, teamName, logo, played, won, drawn, lost, gd, points, form: forms });
        });
        return teams;
    } catch (e) {
        console.error('[bongda24h] fetchDetailedStandings error:', e.message);
        return null;
    }
}

async function getStandings() {
    if (Date.now() < standingsCache.expiresAt && standingsCache.data) return standingsCache.data;

    console.log('[bongda24h] Fetching standings HTML...');
    const start = Date.now();
    try {
        const result = await fetchFromBongda24h();
        const leaguesCount = result.leagues ? result.leagues.length : 0;
        const navCount = result.navigation ? result.navigation.length : 0;
        console.log(`[bongda24h] Parsed ${leaguesCount} leagues and ${navCount} regions in ${Date.now() - start}ms`);
        standingsCache = { data: result, expiresAt: Date.now() + CACHE_TTL };
        return standingsCache.data;
    } catch (e) {
        console.error('[bongda24h] Returning stale cache due to error:', e.message);
        if (standingsCache.data) return standingsCache.data;
        return { leagues: [], navigation: [] };
    }
}

module.exports = {
    getStandings,
    fetchDetailedStandings,
    clearCache: () => {
        standingsCache = { data: null, expiresAt: 0 };
    }
};

// Pre-warm cache on startup
setTimeout(() => {
    console.log('[bongda24h] Pre-warming standings cache...');
    getStandings().catch(() => {});
}, 3000);
