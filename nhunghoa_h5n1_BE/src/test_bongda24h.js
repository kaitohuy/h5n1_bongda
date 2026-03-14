const fs = require('fs');

async function test() {
    try {
        console.log("Fetching https://bongda24h.vn/bang-xep-hang.html ...");
        const res = await fetch('https://bongda24h.vn/bang-xep-hang.html');
        const text = await res.text();
        
        fs.writeFileSync('bongda24h_bxh.html', text);
        console.log("Saved to bongda24h_bxh.html. File size:", text.length);
        
        // Find if they load an iframe or direct table
        if (text.includes('<table')) {
            console.log("Contains table tags!");
        } else {
            console.log("No table tags found. Might be dynamically rendered or inside an iframe.");
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
