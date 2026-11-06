// Kopiert die Web-App (eine Ebene höher) nach ./web, damit Electron sie mitpacken kann.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..');
const dst = path.join(__dirname, 'web');
const ITEMS = ['index.html', 'app.js', 'style.css', 'data', 'vendor'];

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const item of ITEMS) {
  fs.cpSync(path.join(src, item), path.join(dst, item), { recursive: true });
}
fs.copyFileSync(path.join(__dirname, 'build', 'icon.png'), path.join(dst, 'icon.png'));
console.log('Web-App nach ' + dst + ' kopiert.');
