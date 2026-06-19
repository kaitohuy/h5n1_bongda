async function run() {
    try {
        const res = await fetch('https://tieulam.tv', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const text = await res.text();
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('score-')) {
                console.log(`Line ${idx + 1}: ${line}`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}
run();
