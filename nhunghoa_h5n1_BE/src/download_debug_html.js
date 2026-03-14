const fs = require('fs');

async function downloadHTML() {
    const url = 'https://bongda24h.vn/bang-xep-hang.html';
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            }
        });
        const html = await res.text();
        fs.writeFileSync('src/debug_full_page.html', html);
        console.log('Saved to src/debug_full_page.html');
    } catch (e) {
        console.error(e);
    }
}

downloadHTML();
