/**
 * convert.js
 * Hastalık_Arama.xls ve KisitlamaMahalleAra.xls dosyalarını
 * data/hastalıklar.json ve data/karantina.json dosyalarına çevirir.
 *
 * Kullanım: node convert.js
 */

const XLSX = require('./node_modules/xlsx');
const fs = require('fs');
const path = require('path');

// Çıktı klasörü
const outDir = path.join(__dirname, 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Excel seri tarihini ISO 8601 string'e çevir
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const d = new Date(utcValue);
  return d.toISOString().split('T')[0];
}

// Türkçe karakter normalizasyonu (eşleştirme için)
function normalizeTR(str) {
  if (!str) return '';
  return str
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();
}

// ─── 1. Hastalık_Arama.xls → hastalıklar.json ───────────────────────────────
console.log('\n📋 Hastalık_Arama.xls okunuyor...');
const wb1 = XLSX.readFile('Hastalık_Arama.xls');
const ws1 = wb1.Sheets[wb1.SheetNames[0]];
const raw1 = XLSX.utils.sheet_to_json(ws1);

const hastalıklar = raw1.map((row, i) => ({
  id: i + 1,
  bildirimNo: row['Bildirim No'] || '',
  il: row['İl'] || '',
  ilce: row['İlçe'] || '',
  mahalle: row['Mahalle'] || '',
  isletme: row['İşletme'] || '',
  tur: row['Tür'] || '',
  hastalik: row['Hastalık'] || '',
  durum: row['Durum'] || '',
  ihbarTarihi: excelDateToISO(row['İhbar Tarihi']),
  kordinasyonTarihi: excelDateToISO(row['Varış ve Kordon Tarihi']),
  cikisTarihi: excelDateToISO(row['Çıkış Tarihi']),
  onaylamaTarihi: excelDateToISO(row['Onaylama Tarihi']),
  hastalikBitisTarihi: excelDateToISO(row['Hastalık Bitiş Tarihi']),
  sonZiyaretTarihi: excelDateToISO(row['Son Ziyaret Tarihi']),
  ziyaretSayisi: row['Ziyaret Sayısı'] || 0,
  enlem: row['Enlem (X)'] || null,
  boylam: row['Boylam (Y)'] || null,
})).filter(r => r.enlem && r.boylam);

console.log(`  ✅ ${hastalıklar.length} hastalık kaydı işlendi.`);
fs.writeFileSync(
  path.join(outDir, 'hastaliklar.json'),
  JSON.stringify({ guncelleme: new Date().toISOString(), kayitlar: hastalıklar }, null, 2),
  'utf8'
);
console.log('  \u{1F4BE} data/hastaliklar.json yazildi.');

// ─── 2. KisitlamaMahalleAra.xls → karantina.json ────────────────────────────
console.log('\n📋 KisitlamaMahalleAra.xls okunuyor...');
const wb2 = XLSX.readFile('KisitlamaMahalleAra.xls');
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
const raw2 = XLSX.utils.sheet_to_json(ws2);

const karantina = raw2.map((row, i) => {
  const mahalleBirlesik = row['Mahalle'] || '';
  const mahalleler = mahalleBirlesik
    .split(',')
    .map(m => m.trim())
    .filter(m => m.length > 0);

  return {
    id: i + 1,
    il: row['İl'] || '',
    ilce: row['İlçe'] || '',
    mahalleler: mahalleler,
    kisitlamaSebebi: row['Kısıtlama Sebebi'] || '',
    kisitlamaTipi: row['Kısıtlama Tipi'] || '',
    hastalik: row['Hastalık'] || '',
    bildirimTarihi: excelDateToISO(row['Bildirim Tarihi']),
    baslangicTarihi: excelDateToISO(row['Başlangıç Tarihi']),
    bitisTarihi: excelDateToISO(row['Bitiş Tarihi']) || null,
    aktif: !row['Bitiş Tarihi'], // Bitiş tarihi yoksa aktif
  };
}).filter(r => r.mahalleler.length > 0);

console.log(`  ✅ ${karantina.length} kısıtlama kaydı işlendi.`);

// ─── 3. GeoJSON Eşleştirmesi ─────────────────────────────────────────────────
console.log('\n🗺️  Mahalleler.json ile eşleştirme yapılıyor...');
const geo = JSON.parse(fs.readFileSync('Mahalleler.json', 'utf8'));

// Tüm benzersiz mahalle isimlerini GeoJSON'dan çıkar
const geoMahalleler = new Set(
  geo.features.map(f => normalizeTR(f.properties.AD + '|' + f.properties.ILCEAD))
);

let eslesmeyenler = [];
karantina.forEach(k => {
  k.mahalleler.forEach(m => {
    const key = normalizeTR(m + '|' + k.ilce);
    if (!geoMahalleler.has(key)) {
      eslesmeyenler.push({ aranan: m, ilce: k.ilce, normalIlce: normalizeTR(k.ilce) });
    }
  });
});

if (eslesmeyenler.length > 0) {
  console.log(`\n  ⚠️  GeoJSON'da bulunamayan ${eslesmeyenler.length} mahalle:`);
  eslesmeyenler.forEach(e => {
    // Fuzzy: sadece mahalle adı ile ara
    const sadeceMahalle = normalizeTR(e.aranan);
    const benzerler = geo.features
      .filter(f => normalizeTR(f.properties.AD) === sadeceMahalle)
      .map(f => `${f.properties.AD} / ${f.properties.ILCEAD}`);
    console.log(`    - "${e.aranan}" (${e.ilce}) → Benzerler: ${benzerler.join(', ') || 'YOK'}`);
  });
} else {
  console.log('  ✅ Tüm mahalleler GeoJSON ile eşleşti!');
}

fs.writeFileSync(
  path.join(outDir, 'karantina.json'),
  JSON.stringify({ guncelleme: new Date().toISOString(), kayitlar: karantina }, null, 2),
  'utf8'
);
console.log('\n  data/karantina.json yazildi.');

// ─── 4. Karantina mahalleleri GeoJSON'a embed et ─────────────────────────────
console.log('\n🗺️  Karantina bilgileri GeoJSON\'a ekleniyor...');

// Aktif karantinadaki tüm mahalle+ilçe kombinasyonlarını hazırla
const karantinaMap = new Map(); // "MAHALLE|ILÇe" -> kısıtlama bilgileri
karantina.forEach(k => {
  if (!k.aktif) return;
  k.mahalleler.forEach(m => {
    const keyNorm = normalizeTR(m) + '|' + normalizeTR(k.ilce);
    // Aynı mahalle birden fazla kısıtlamada olabilir
    const mevcut = karantinaMap.get(keyNorm) || [];
    mevcut.push({
      hastalik: k.hastalik,
      kisitlamaTipi: k.kisitlamaTipi,
      baslangicTarihi: k.baslangicTarihi,
    });
    karantinaMap.set(keyNorm, mevcut);
    // Sadece mahalle adıyla da dene
    const keyOnly = normalizeTR(m) + '|*';
    const mevcutOnly = karantinaMap.get(keyOnly) || [];
    mevcutOnly.push({ hastalik: k.hastalik, kisitlamaTipi: k.kisitlamaTipi, baslangicTarihi: k.baslangicTarihi, ilce: k.ilce });
    karantinaMap.set(keyOnly, mevcutOnly);
  });
});

// GeoJSON'a karantina alanlarını işaretle
let isaretlenenCount = 0;
geo.features.forEach(f => {
  const adNorm = normalizeTR(f.properties.AD);
  const ilceNorm = normalizeTR(f.properties.ILCEAD);
  const key1 = adNorm + '|' + ilceNorm;
  const kisitlamalar = karantinaMap.get(key1) || [];
  
  if (kisitlamalar.length > 0) {
    f.properties.karantina = kisitlamalar;
    f.properties.karantinaAktif = true;
    // En ağır kısıtlama tipi
    const enAgir = kisitlamalar.find(k => k.kisitlamaTipi.includes('Koruma')) 
      ? 'koruma' : 'gozetime';
    f.properties.karantinaTipi = enAgir;
    isaretlenenCount++;
  } else {
    f.properties.karantinaAktif = false;
  }
});

console.log(`  ✅ ${isaretlenenCount} mahalle karantina olarak işaretlendi.`);

fs.writeFileSync(
  path.join(outDir, 'mahalleler_karantina.json'),
  JSON.stringify(geo, null, 0),
  'utf8'
);
console.log('  data/mahalleler_karantina.json yazildi.');

console.log('\nTum donusturme tamamlandi!');
console.log('   - data/hastaliklar.json');
console.log('   - data/karantina.json');
console.log('   - data/mahalleler_karantina.json');
