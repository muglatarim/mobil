/**
 * data.js - Veri yükleme ve işleme modülü
 */

// Türkçe karakter normalizasyonu (ASCII karşılıklarına çevirme)
export function normalizeTR(str) {
  if (!str) return '';
  return String(str)
    .toUpperCase()
    .replace(/\u0130/g, 'I')  // İ
    .replace(/\u011e/g, 'G')  // Ğ
    .replace(/\u00dc/g, 'U')  // Ü
    .replace(/\u015e/g, 'S')  // Ş
    .replace(/\u00d6/g, 'O')  // Ö
    .replace(/\u00c7/g, 'C')  // Ç
    .replace(/\u0131/g, 'I')  // ı
    .replace(/\u00fc/g, 'U')  // ü
    .replace(/\u015f/g, 'S')  // ş
    .replace(/\u00f6/g, 'O')  // ö
    .replace(/\u00e7/g, 'C')  // ç
    .replace(/\u011f/g, 'G')  // ğ
    .trim();
}

let _hastaliklar = null;
let _karantina = null;
let _geoJSON = null;

// Tüm veri dosyalarını yükle
export async function loadAllData() {
  try {
    const [h, k, g] = await Promise.all([
      fetch('./data/hastaliklar.json').then(r => r.json()),
      fetch('./data/karantina.json').then(r => r.json()),
      fetch('./data/mahalleler_karantina.json').then(r => r.json()),
    ]);
    _hastaliklar = h;
    _karantina = k;
    _geoJSON = g;
    return { hastaliklar: h, karantina: k, geoJSON: g };
  } catch (err) {
    console.error('Veri yukleme hatasi:', err);
    throw err;
  }
}

export function getHastaliklar() { return _hastaliklar?.kayitlar || []; }
export function getKarantina() { return _karantina?.kayitlar || []; }
export function getGeoJSON() { return _geoJSON; }
export function getGuncelleme() {
  const t = _karantina?.guncelleme;
  if (!t) return null;
  return new Date(t).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Aktif karantinadaki tüm mahalle isimlerini döndür (normalize edilmis set)
export function buildKarantinaSet() {
  const set = new Map();
  const karantina = getKarantina();
  karantina.forEach(k => {
    if (!k.aktif) return;
    k.mahalleler.forEach(m => {
      const key = normalizeTR(m) + '|' + normalizeTR(k.ilce);
      const mevcut = set.get(key) || [];
      mevcut.push(k);
      set.set(key, mevcut);
    });
  });
  return set;
}

// Belirli bir mahalle ozelliginin karantina bilgisini getir
export function getMahalleKarantina(properties) {
  if (!properties?.karantinaAktif) return null;
  return properties.karantina || null;
}

// Istatistikler
export function getStats() {
  const h = getHastaliklar();
  const k = getKarantina();
  const aktifKar = k.filter(r => r.aktif);
  const toplamMahalle = aktifKar.reduce((s, r) => s + r.mahalleler.length, 0);
  const koruma = aktifKar.filter(r => r.kisitlamaTipi?.includes('Koruma'));
  const korumaCount = koruma.reduce((s, r) => s + r.mahalleler.length, 0);
  return {
    hastalikCount: h.length,
    karantinaCount: toplamMahalle,
    korumaCount,
    gozetimCount: toplamMahalle - korumaCount,
  };
}
