/**
 * fix_kavaklidere.js
 * KAVAKLIDERE|ÇAMLIBELÇAMLIYURT kaydini:
 *   - KAVAKLIDERE|ÇAMLIBEL (kimlik: 176369) olarak yeniden adlandirir
 *   - KAVAKLIDERE|ÇAMLIYURT (kimlik: 176371) olarak yeni kayit ekler
 */
const fs = require('fs');

const dosya = 'data/eslesme.json';
const e = JSON.parse(fs.readFileSync(dosya, 'utf8'));

const eskiKey = 'KAVAKLIDERE|\u00c7AMLIBEL\u00c7AMLIYURT';

if (!e.eslesmeler[eskiKey]) {
  console.log('Kayit bulunamadi:', eskiKey);
  process.exit(1);
}

// 1. Eski kaydi sil
delete e.eslesmeler[eskiKey];
console.log('Silindi:', eskiKey);

// 2. CAMLIBEL kaydini ekle (kimlik 176369)
const yeniKeyCAMLIBEL = 'KAVAKLIDERE|\u00c7AMLIBEL';
e.eslesmeler[yeniKeyCAMLIBEL] = {
  sistemIlce: 'KAVAKLIDERE',
  sistemMahalle: '\u00c7AMLIBEL',
  eslesmeler: [176369],
  eslesmeTuru: 'duzeltildi',
  manuelOnaylandi: true,
};
console.log('Eklendi:', yeniKeyCAMLIBEL, '-> kimlik 176369');

// 3. CAMLIYURT kaydini ekle (kimlik 176371)
const yeniKeyCAMLIYURT = 'KAVAKLIDERE|\u00c7AMLIYURT';
e.eslesmeler[yeniKeyCAMLIYURT] = {
  sistemIlce: 'KAVAKLIDERE',
  sistemMahalle: '\u00c7AMLIYURT',
  eslesmeler: [176371],
  eslesmeTuru: 'duzeltildi',
  manuelOnaylandi: true,
};
console.log('Eklendi:', yeniKeyCAMLIYURT, '-> kimlik 176371');

// 4. geoEslesmeyenler listesinden bu iki kimliği kaldir (artik atamalari var)
const once = e.geoEslesmeyenler.length;
e.geoEslesmeyenler = e.geoEslesmeyenler.filter(
  g => g.kimlikno !== 176369 && g.kimlikno !== 176371
);
console.log('geoEslesmeyenler: ' + once + ' -> ' + e.geoEslesmeyenler.length);

// 5. Metaveriler guncelle
e.metaveriler.olusturmaTarihi = new Date().toISOString();
e.metaveriler.toplamSistemMahalle = Object.keys(e.eslesmeler).length;

fs.writeFileSync(dosya, JSON.stringify(e, null, 2), 'utf8');
console.log('\neslesme.json guncellendi.');
console.log('Toplam sistem mahalle:', e.metaveriler.toplamSistemMahalle);
