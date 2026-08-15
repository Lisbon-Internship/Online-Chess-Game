const fs = require('fs');
const pieces = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp'];
let out = 'const piecesSvg = {\n';

for (let p of pieces) {
    let content = fs.readFileSync(p + '.svg', 'utf8');
    // Remove xml declaration and doctype
    content = content.replace(/<\?xml.*?\?>/, '');
    content = content.replace(/<!DOCTYPE.*?>/, '');
    // Minify it a bit
    content = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
    out += `    '${p}': \`${content}\`,\n`;
}

out += '};\n';
fs.writeFileSync('../js/assets.js', out);
