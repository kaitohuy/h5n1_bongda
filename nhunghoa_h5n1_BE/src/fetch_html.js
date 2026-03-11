const fs = require('fs');
fetch('https://xem1.gv05.live/trang-chu', { headers: { 'User-Agent': 'Mozilla/5.0' } })
    .then(async r => {
        const html = await r.text();
        fs.writeFileSync('gavang_home.html', html);
        console.log('Saved to gavang_home.html, length:', html.length);

        const match = html.match(/id="__NEXT_DATA__".*?>(.*?)<\/script>/s);
        if (match) {
            const data = JSON.parse(match[1]);
            fs.writeFileSync('gavang_next_data.json', JSON.stringify(data, null, 2));
            console.log('Saved NEXT_DATA size:', match[1].length);
        } else {
            console.log('NEXT_DATA not found');
        }
    }).catch(console.error);
