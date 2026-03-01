/**
 * test_scraper.js — Run this directly to debug the scraper
 * Usage: node test_scraper.js
 */
require('dotenv').config();

const { scrapeMatchList } = require('./src/scraper');

(async () => {
    console.log('🔍 Testing scraper on 90phutit.cc...\n');
    try {
        const result = await scrapeMatchList('https://90phutit.cc/', 30000);
        console.log('✅ Success!');
        console.log(`   Found: ${result.matches?.length ?? 0} matches`);
        if (result.matches?.length > 0) {
            console.log('\n📋 First 3 matches:');
            result.matches.slice(0, 3).forEach((m, i) => {
                console.log(`  [${i + 1}] ${m.home} vs ${m.away} | ${m.league} | ${m.time} | ${m.status}`);
                console.log(`       URL: ${m.sourceUrl}`);
            });
        }
        if (result.debug) {
            console.log('\n⚠️  Debug info (selector may have failed):');
            console.log('   All links found:', result.debug.allLinks?.slice(0, 5));
        }
    } catch (err) {
        console.error('❌ Scraper error:', err.message);
        if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    }
})();
