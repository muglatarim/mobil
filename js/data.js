import { db } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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
let _eslesme = null;

// Tüm veri dosyalarını yükle (Realtime Database'den)
export async function loadAllData() {
  try {
    const [hSnapshot, kSnapshot, g, e] = await Promise.all([
      get(ref(db, "hastaliklar")),
      get(ref(db, "ayarlar/karantina")),
      fetch('./Mahalleler.json').then(r => r.json()),
      fetch('./data/eslesme.json').then(r => r.json()).catch(() => ({ eslesmeler: {} })),
    ]);

    // Hastalıkları işle (Dizi olarak sakladık)
    const hastaliklarRecords = hSnapshot.exists() ? hSnapshot.val() : [];
    _hastaliklar = { kayitlar: Array.isArray(hastaliklarRecords) ? hastaliklarRecords : Object.values(hastaliklarRecords) };

    // Karantina verisini işle
    if (kSnapshot.exists()) {
      _karantina = kSnapshot.val();
    } else {
      _karantina = { guncelleme: new Date().toISOString(), kayitlar: [] };
    }
    
    // Eşleştirme tablosu anahtarlarını normalize et (MILAS|DEREKOY gibi)
    const normalizedEslesme = {};
    if (e && e.eslesmeler) {
      Object.entries(e.eslesmeler).forEach(([key, val]) => {
        normalizedEslesme[normalizeTR(key)] = val;
      });
    }
    _eslesme = { eslesmeler: normalizedEslesme };
    _geoJSON = processGeoJSON(g, _karantina.kayitlar, _eslesme.eslesmeler);
    
    return { hastaliklar: _hastaliklar, karantina: _karantina, geoJSON: _geoJSON };
  } catch (err) {
    console.error('Veri yukleme hatasi (RTDB):', err);
    throw err;
  }
}


// GeoJSON verisi ile karantina verisini birleştir (Manuel eşleşmeleri dikkate alarak)
function processGeoJSON(geo, karantinaList, manualMatches = {}) {
  const aktifKarantinalar = karantinaList.filter(r => r.aktif);
  
  // 1. İsim bazlı eşleştirme için map oluştur
  const karantinaByIsim = new Map();
  // 2. KIMLIKNO (ID) bazlı eşleştirme için map oluştur (eslesme.json'dan)
  const karantinaByID = new Map();

  aktifKarantinalar.forEach(k => {
    const ilceNorm = normalizeTR(k.ilce);
    k.mahalleler.forEach(m => {
      const mahalleNorm = normalizeTR(m);
      const key = ilceNorm + '|' + mahalleNorm;
      
      // a) İsim bazlı kaydet
      const mevcutIsim = karantinaByIsim.get(key) || [];
      const kData = {
        hastalik: k.hastalik,
        kisitlamaTipi: k.kisitlamaTipi,
        baslangicTarihi: k.baslangicTarihi
      };
      mevcutIsim.push(kData);
      karantinaByIsim.set(key, mevcutIsim);

      // b) Manuel eşleşme varsa ID bazlı kaydet
      const manual = manualMatches[key];
      if (manual && manual.eslesmeler) {
        manual.eslesmeler.forEach(id => {
          const mevcutID = karantinaByID.get(id) || [];
          mevcutID.push(kData);
          karantinaByID.set(id, mevcutID);
        });
      }
    });
  });

  geo.features.forEach(f => {
    const props = f.properties;
    const adNorm = normalizeTR(props.AD);
    const ilceNorm = normalizeTR(props.ILCEAD);
    const key = ilceNorm + '|' + adNorm;
    
    // Önce ID bazlı bak (manuel eşleşme öncelikli)
    let kisitlamalar = karantinaByID.get(props.KIMLIKNO) || [];
    
    // Eğer ID bazlı yoksa isim bazlı bak
    if (kisitlamalar.length === 0) {
      kisitlamalar = karantinaByIsim.get(key) || [];
    }
    
    if (kisitlamalar.length > 0) {
      f.properties.karantina = kisitlamalar;
      f.properties.karantinaAktif = true;
      f.properties.karantinaTipi = kisitlamalar.find(kx => kx.kisitlamaTipi.includes('Koruma')) ? 'koruma' : 'gozetime';
    } else {
      f.properties.karantinaAktif = false;
      delete f.properties.karantina;
      delete f.properties.karantinaTipi;
    }
  });

  return geo;
}

export function getHastaliklar() { return _hastaliklar?.kayitlar || []; }
export function getKarantina() { return _karantina?.kayitlar || []; }
export function getGeoJSON() { return _geoJSON; }

// Benzersiz hastalık isimlerini döndür
export function getUniqueDiseases() {
  const hastaliklar = getHastaliklar();
  const set = new Set();
  hastaliklar.forEach(h => {
    if (h.hastalik) {
      let name = h.hastalik.trim().toUpperCase();
      if (name.startsWith('ŞAP')) {
        name = 'ŞAP';
      }
      set.add(name);
    }
  });
  return Array.from(set).sort();
}

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
