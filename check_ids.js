const fs = require('fs');
const js = fs.readFileSync('src/main.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const regex = /\$\(['"]([^'"]+)['"]\)/g;
let match;
const missing = new Set();
while ((match = regex.exec(js)) !== null) {
  const id = match[1];
  if (!html.includes('id="' + id + '"')) {
    missing.add(id);
  }
}
console.log('Missing IDs:', Array.from(missing));
