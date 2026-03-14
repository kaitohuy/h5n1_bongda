const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('bongda24h_bxh.html','utf-8');
const $ = cheerio.load(html);
console.log($('table').first().find('tbody tr').eq(1).html());
