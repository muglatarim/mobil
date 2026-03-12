/**
 * build_eslesme.js
 * Sistem mahallelerini GeoJSON mahalleleriyle otomatik eslestirir.
 * Sonucu data/eslesme.json olarak yazar.
 * 
 * Kurallar:
 * 1. Birebir eslesme (normalize edilmis)
 * 2. MERKEZ-XXX -> XXX
 * 3. Yazim benzerligi (substring, suffix)
 * 4. Eslesemeyen -> bos liste (manuel eslestirilecek)
 */
const XLSX = require('./node_modules/xlsx');
const fs = require('fs');
const path = require('path');

function normalizeTR(str) {
  if (!str) return '';
  return String(str).toUpperCase()
    .replace(/\u0130/g,'I').replace(/\u011e/g,'G').replace(/\u00dc/g,'U')
    .replace(/\u015e/g,'S').replace(/\u00d6/g,'O').replace(/\u00c7/g,'C')
    .replace(/\u0131/g,'I').replace(/\u00fc/g,'U').replace(/\u015f/g,'S')
    .replace(/\u00f6/g,'O').replace(/\u00e7/g,'C').replace(/\u011f/g,'G').trim();
}

// Sistem mahallelerini oku
const wb = XLSX.readFile('Sistem Mahalleler.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, {header:1});

const sistemMahalleler = []; // [{ilce, mahalle, ilceNorm, mahalleNorm}]
rows.forEach(r => {
  if (!r[0] || !r[1]) return;
  sistemMahalleler.push({
    ilce: String(r[0]),
    mahalle: String(r[1]),
    ilceNorm: normalizeTR(r[0]),
    mahalleNorm: normalizeTR(r[1]),
  });
});

// GeoJSON mahallelerini oku - ilce bazinda indeksle
const geo = JSON.parse(fs.readFileSync('Mahalleler.json'));
const geoByIlce = {}; // ilceNorm -> [{ad, adNorm, kimlikno}]
geo.features.forEach(f => {
  const ilceNorm = normalizeTR(f.properties.ILCEAD);
  if (!geoByIlce[ilceNorm]) geoByIlce[ilceNorm] = [];
  geoByIlce[ilceNorm].push({
    ad: f.properties.AD,
    adNorm: normalizeTR(f.properties.AD),
    kimlikno: f.properties.KIMLIKNO,
    ilce: f.properties.ILCEAD,
  });
});

// Otomatik eslestirme fonksiyonu
function otomatikEslestir(sistemMahalleNorm, ilceNorm) {
  const geoMahalleler = geoByIlce[ilceNorm] || [];
  
  // Kural 1: Birebir esleme
  let exact = geoMahalleler.filter(g => g.adNorm === sistemMahalleNorm);
  if (exact.length > 0) return { turu: 'birebir', eslesmeler: exact.map(g => g.kimlikno) };
  
  // Kural 2: MERKEZ-XXX -> XXX
  let temiz = sistemMahalleNorm;
  if (temiz.startsWith('MERKEZ-')) {
    temiz = temiz.replace('MERKEZ-', '');
    exact = geoMahalleler.filter(g => g.adNorm === temiz);
    if (exact.length > 0) return { turu: 'merkez_prefix', eslesmeler: exact.map(g => g.kimlikno) };
    // Ayrica MERKEZ adini tum eslesmeler icin ara
    const mkz = geoMahalleler.filter(g => g.adNorm === 'MERKEZ');
    if (mkz.length > 0) {
      // MERKEZ poligonu varsa onu da ekle
    }
  }
  
  // Kural 3: XXX-YYY -> ayri aramalarda her ikisini de ara
  if (sistemMahalleNorm.includes('-')) {
    const parcalar = sistemMahalleNorm.split('-').map(p => p.trim());
    let bulunanlar = [];
    parcalar.forEach(p => {
      const buldu = geoMahalleler.filter(g => g.adNorm === p || g.adNorm.includes(p) || p.includes(g.adNorm));
      bulunanlar.push(...buldu);
    });
    bulunanlar = [...new Map(bulunanlar.map(g => [g.kimlikno, g])).values()];
    if (bulunanlar.length > 0) return { turu: 'parcali', eslesmeler: bulunanlar.map(g => g.kimlikno) };
  }
  
  // Kural 4: Substring - sistem mahallesi geo mahallesinin ici geciyorsa
  const substring1 = geoMahalleler.filter(g => 
    g.adNorm.includes(sistemMahalleNorm) || sistemMahalleNorm.includes(g.adNorm)
  );
  if (substring1.length > 0) return { turu: 'substring', eslesmeler: substring1.map(g => g.kimlikno) };
  
  // Kural 5: Bosluk kaldir ve eslesmeye calis
  const temizSis = sistemMahalleNorm.replace(/\s+/g,'');
  const temizGeo = geoMahalleler.filter(g => g.adNorm.replace(/\s+/g,'') === temizSis);
  if (temizGeo.length > 0) return { turu: 'bosluksuz', eslesmeler: temizGeo.map(g => g.kimlikno) };
  
  // Eslesemedi
  return { turu: 'eslesmedi', eslesmeler: [] };
}

// Tum sistem mahalleleri icin eslestir
const eslesme = {};
let birebir = 0, otomatik = 0, eslesmedi = 0;

sistemMahalleler.forEach(s => {
  const key = s.ilce + '|' + s.mahalle;
  const sonuc = otomatikEslestir(s.mahalleNorm, s.ilceNorm);
  
  eslesme[key] = {
    sistemIlce: s.ilce,
    sistemMahalle: s.mahalle,
    eslesmeler: sonuc.eslesmeler, // KIMLIKNO listesi
    eslesmeTuru: sonuc.turu,
    manuelOnaylandi: sonuc.turu === 'birebir', // Birebir olanlar otomatik onaylandi
  };
  
  if (sonuc.turu === 'birebir') birebir++;
  else if (sonuc.eslesmeler.length > 0) otomatik++;
  else eslesmedi++;
});

// GeoJSON'da olup sistemde olmayan mahalleleri bul
const geoEslesmeyenler = []; // Hicbir sistem mahallesine eslenmemis geo mahalleler
const kullanilmisKimlikler = new Set();
Object.values(eslesme).forEach(e => e.eslesmeler.forEach(k => kullanilmisKimlikler.add(k)));

geo.features.forEach(f => {
  if (!kullanilmisKimlikler.has(f.properties.KIMLIKNO)) {
    geoEslesmeyenler.push({
      ad: f.properties.AD,
      ilce: f.properties.ILCEAD,
      kimlikno: f.properties.KIMLIKNO,
    });
  }
});

const cikti = {
  metaveriler: {
    olusturmaTarihi: new Date().toISOString(),
    toplamSistemMahalle: sistemMahalleler.length,
    birebir,
    otomatikEslesmis: otomatik,
    eslesmemis: eslesmedi,
    geoEslesmeyenSayisi: geoEslesmeyenler.length,
  },
  eslesmeler: eslesme,
  geoEslesmeyenler,
};

const outDir = path.join(__dirname, 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
fs.writeFileSync(path.join(outDir, 'eslesme.json'), JSON.stringify(cikti, null, 2), 'utf8');

console.log('Eslestirme tamamlandi:');
console.log('  Birebir:', birebir);
console.log('  Otomatik (incelenmeli):', otomatik);
console.log('  Eslesmedi (manuel gerekli):', eslesmedi);
console.log('  GeoJSONda kalan (atanmamis):', geoEslesmeyenler.length);
console.log('  -> data/eslesme.json yazildi');
