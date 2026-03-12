const fs = require('fs');
const path = require('path');

// icons/ klasörü oluştur
const iconsDir = path.join('icons');
if(!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

function makeSVG(size) {
  const r = Math.round(size * 0.2);
  const fs2 = Math.round(size * 0.5);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">',
    '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#1e40af"/>',
    '<stop offset="100%" stop-color="#1d4ed8"/>',
    '</linearGradient></defs>',
    '<rect width="' + size + '" height="' + size + '" rx="' + r + '" fill="url(#bg)"/>',
    '<text x="50%" y="56%" font-size="' + fs2 + '" text-anchor="middle" dominant-baseline="middle">&#x1F5FA;</text>',
    '</svg>'
  ].join('');
}

fs.writeFileSync(path.join(iconsDir,'icon-192.svg'), makeSVG(192));
fs.writeFileSync(path.join(iconsDir,'icon-512.svg'), makeSVG(512));
fs.copyFileSync(path.join(iconsDir,'icon-192.svg'), path.join(iconsDir,'icon-192.png'));
fs.copyFileSync(path.join(iconsDir,'icon-512.svg'), path.join(iconsDir,'icon-512.png'));

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
manifest.icons = [
  { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
  { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
];
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log('OK: ikonlar ve manifest guncellendi');
