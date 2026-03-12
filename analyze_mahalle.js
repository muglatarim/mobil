const XLSX = require('./node_modules/xlsx');
const fs = require('fs');

function normalizeTR(str) {
  if (!str) return '';
  return String(str).toUpperCase()
    .replace(/\u0130/g, 'I').replace(/\u011e/g, 'G').replace(/\u00dc/g, 'U')
    .replace(/\u015e/g, 'S').replace(/\u00d6/g, 'O').replace(/\u00c7/g, 'C')
    .replace(/\u0131/g, 'I').replace(/\u00fc/g, 'U').replace(/\u015f/g, 'S')
    .replace(/\u00f6/g, 'O').replace(/\u00e7/g, 'C').replace(/\u011f/g, 'G').trim();
}

const wb = XLSX.readFile('Sistem Mahalleler.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Sistem mahallelerini ilce bazinda grupla
const sistemIlce = {};
const sistemOrijinal = {}; // normalize -> orijinal isim
rows.forEach(r => {
  if (!r[0] || !r[1]) return;
  const ilce = normalizeTR(r[0]);
  const mah = normalizeTR(r[1]);
  const mahOrig = String(r[1]);
  if (!sistemIlce[ilce]) sistemIlce[ilce] = new Set();
  sistemIlce[ilce].add(mah);
  if (!sistemOrijinal[ilce]) sistemOrijinal[ilce] = {};
  sistemOrijinal[ilce][mah] = mahOrig;
});

// GeoJSON mahallelerini ilce bazinda grupla
const geo = JSON.parse(fs.readFileSync('Mahalleler.json'));
const geoIlce = {};
const geoOrijinal = {};
geo.features.forEach(f => {
  const ilce = normalizeTR(f.properties.ILCEAD);
  const mah = normalizeTR(f.properties.AD);
  if (!geoIlce[ilce]) geoIlce[ilce] = new Set();
  geoIlce[ilce].add(mah);
  if (!geoOrijinal[ilce]) geoOrijinal[ilce] = {};
  geoOrijinal[ilce][mah] = f.properties.AD;
});

// Karsilastir
console.log('=== ESLESMEYEN MAHALLELER ===\n');
let toplamSistemde = 0, toplamGeoJSONda = 0;
const eslesme = {};

Object.keys(sistemIlce).forEach(ilce => {
  const sis = sistemIlce[ilce];
  const geo_ = geoIlce[ilce] || new Set();

  const sisdeVar = [...sis].filter(m => !geo_.has(m));
  const geodaVar = [...geo_].filter(m => !sis.has(m));

  if (sisdeVar.length > 0 || geodaVar.length > 0) {
    toplamSistemde += sisdeVar.length;
    toplamGeoJSONda += geodaVar.length;

    const ilceOrig = rows.find(r => normalizeTR(r[0]) === ilce)?.[0] || ilce;
    console.log('--- ' + ilceOrig + ' ---');
    if (sisdeVar.length > 0) {
      console.log('  SISTEMDE VAR / GEOJSONDA YOK (' + sisdeVar.length + '):');
      sisdeVar.forEach(m => {
        const orig = sistemOrijinal[ilce]?.[m] || m;
        console.log('    [SIS] ' + orig);
      });
    }
    if (geodaVar.length > 0) {
      console.log('  GEOJSONDA VAR / SISTEMDE YOK (' + geodaVar.length + '):');
      geodaVar.forEach(m => {
        const orig = geoOrijinal[ilce]?.[m] || m;
        console.log('    [GEO] ' + orig);
      });
    }
    console.log('');
    eslesme[ilce] = { sisdeVar, geodaVar };
  }
});

console.log('OZET: Sistemde olup GeoJSONda olmayan:', toplamSistemde);
console.log('OZET: GeoJSONda olup sistemde olmayan:', toplamGeoJSONda);
