/**
 * map.js - Leaflet harita işlemleri
 */
import { getHastaliklar, getGeoJSON, normalizeTR } from './data.js';

let map = null;
let geoLayer = null;
let markerLayer = null;
let zoneLayer = null;     // 3km/10km çember katmanı
let zonesVisible = false; // çember görünüm durumu
let userMarker = null;
let selectedLayer = null;

// Hastalık türlerine göre renk
const HASTALIK_RENKLER = {
  'ŞAP': '#ef4444',
  'NEWCASTLE': '#f97316',
  'TÜBERKÜLOZ': '#a855f7',
  'DEFAULT': '#06b6d4',
};

// Hayvan türüne göre emoji ikonu
const HAYVAN_IKONLARI = {
  'SIĞIR':  { emoji: '🐄', label: 'Sığır' },
  'KOYUN':  { emoji: '🐑', label: 'Koyun' },
  'KEÇİ':   { emoji: '🐐', label: 'Keçi' },
  'TAVUK':  { emoji: '🐓', label: 'Tavuk' },
  'HINDI':  { emoji: '🦃', label: 'Hindi' },
  'DEFAULT':{ emoji: '🦠', label: 'Diğer' },
};

function getHayvanIkon(tur) {
  const turNorm = normalizeTR(tur || '');
  for (const [key, val] of Object.entries(HAYVAN_IKONLARI)) {
    if (key === 'DEFAULT') continue;
    if (turNorm.includes(normalizeTR(key))) return val;
  }
  return HAYVAN_IKONLARI.DEFAULT;
}

// ISO tarihi dd/mm/yyyy formatına çevir
function formatTarih(iso) {
  if (!iso) return '-';
  try {
    const [y, m, d] = String(iso).split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch { return iso; }
}

function getHastalikRenk(hastalik) {
  for (const [key, renk] of Object.entries(HASTALIK_RENKLER)) {
    if (hastalik?.toUpperCase().includes(key)) return renk;
  }
  return HASTALIK_RENKLER.DEFAULT;
}

// Mahalle poligon stili
function getMahalleStil(feature) {
  const props = feature.properties;
  if (props.karantinaAktif) {
    if (props.karantinaTipi === 'koruma') {
      return {
        fillColor: '#ef4444',
        fillOpacity: 0.35,
        color: '#ef4444',
        weight: 1.5,
        opacity: 0.8,
      };
    } else {
      return {
        fillColor: '#f97316',
        fillOpacity: 0.25,
        color: '#f97316',
        weight: 1.5,
        opacity: 0.7,
      };
    }
  }
  return {
    fillColor: '#334155',
    fillOpacity: 0.1,
    color: '#475569',
    weight: 0.8,
    opacity: 0.6,
  };
}

function getMahalleHoverStil(feature) {
  const base = getMahalleStil(feature);
  return { ...base, fillOpacity: base.fillOpacity + 0.2, weight: 2.5 };
}

// Popup içeriği
function buildMahallePopup(props) {
  const isKarantina = props.karantinaAktif;
  let html = `<div class="popup-content">`;
  html += `<h3>🏘️ ${props.AD}</h3>`;
  html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:8px">${props.ILCEAD} İlçesi</div>`;

  if (isKarantina && props.karantina) {
    props.karantina.forEach(k => {
      const tipClass = k.kisitlamaTipi?.includes('Koruma') ? 'koruma' : 'gozetime';
      const tipText = k.kisitlamaTipi?.includes('Koruma') ? '🔴 Koruma Bölgesi' : '🟠 Gözetim Bölgesi';
      html += `<div class="badge ${tipClass}">${tipText}</div>`;
      html += `<div class="detail-row"><span>Hastalık</span><span>${k.hastalik || '-'}</span></div>`;
      html += `<div class="detail-row"><span>Başlangıç</span><span>${k.baslangicTarihi || '-'}</span></div>`;
    });
  } else {
    html += `<div class="badge" style="background:rgba(71,85,105,0.2);color:#94a3b8;border:1px solid rgba(71,85,105,0.4)">✅ Kısıtlama Yok</div>`;
  }

  html += `</div>`;
  return html;
}

// Harita başlatma
export function initMap(containerId) {
  map = L.map(containerId, {
    center: [37.15, 28.36], // Muğla merkezi
    zoom: 9,
    zoomControl: false,
  });

  // Karanlık harita katmanı (OpenStreetMap tabanlı - ücretsiz)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap ©CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // Zoom kontrolleri sağ alt
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  return map;
}

// GeoJSON mahalle katmanını yükle
export function loadMahalleLayer(onMahalleClick) {
  const geo = getGeoJSON();
  if (!geo) return;

  geoLayer = L.geoJSON(geo, {
    style: getMahalleStil,
    onEachFeature(feature, layer) {
      // Hover efektleri
      layer.on('mouseover', function() {
        this.setStyle(getMahalleHoverStil(feature));
      });
      layer.on('mouseout', function() {
        if (selectedLayer !== this) {
          geoLayer.resetStyle(this);
        }
      });

      // Tıklama
      layer.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        if (selectedLayer) geoLayer.resetStyle(selectedLayer);
        selectedLayer = this;
        this.setStyle({
          weight: 3,
          color: '#3b82f6',
          fillOpacity: getMahalleStil(feature).fillOpacity + 0.15,
        });

        // Popup
        const popup = L.popup({ maxWidth: 280, className: 'custom-popup' })
          .setLatLng(e.latlng)
          .setContent(buildMahallePopup(feature.properties))
          .openOn(map);

        popup.on('remove', () => {
          if (selectedLayer) {
            geoLayer.resetStyle(selectedLayer);
            selectedLayer = null;
          }
        });

        onMahalleClick?.(feature.properties);
      });
    },
  }).addTo(map);

  return geoLayer;
}

// Hastalık mihrakı markerlarını yükle
export function loadHastalikMarkers() {
  const hastaliklar = getHastaliklar();
  markerLayer = L.layerGroup().addTo(map);
  zoneLayer   = L.layerGroup(); // başlangıçta haritada değil

  hastaliklar.forEach(h => {
    if (!h.enlem || !h.boylam) return;

    const renk      = getHastalikRenk(h.hastalik);
    const hayvan    = getHayvanIkon(h.tur);
    const cikisTarihiStr = formatTarih(h.cikisTarihi);

    // ── Marker ikonu ──────────────────────────────────────────
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${renk}22;border:2px solid ${renk};
        display:flex;align-items:center;justify-content:center;
        font-size:17px;cursor:pointer;
        box-shadow:0 2px 10px ${renk}55;
        transition:transform .15s;
      " title="${h.tur} - ${h.hastalik}">${hayvan.emoji}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // ── Popup ────────────────────────────────────────────────
    const popupHtml = `
      <div class="popup-content">
        <h3>${hayvan.emoji} Hastalık Mihrakı</h3>
        <div class="badge hastalik">🔬 ${h.hastalik}</div>
        <div class="detail-row"><span>Hayvan Türü</span><span>${h.tur}</span></div>
        <div class="detail-row"><span>Mahalle</span><span>${h.mahalle}</span></div>
        <div class="detail-row"><span>İlçe</span><span>${h.ilce}</span></div>
        <div class="detail-row"><span>Durum</span><span>${h.durum}</span></div>
        <div class="detail-row"><span>Çıkış Tarihi</span><span>${cikisTarihiStr}</span></div>
        <div class="detail-row"><span>Son Ziyaret</span><span>${formatTarih(h.sonZiyaretTarihi)}</span></div>
        <div class="detail-row"><span>Bildirim No</span><span>${h.bildirimNo}</span></div>
      </div>
    `;

    // ── 3 km ve 10 km çemberleri ─────────────────────────────
    // Leaflet Circle metre cinsinden radius alır
    const circle3km = L.circle([h.enlem, h.boylam], {
      radius: 3000,
      color: renk,
      weight: 1.5,
      opacity: 0.85,
      fillColor: renk,
      fillOpacity: 0.12,
      dashArray: '5,5',
    });
    const circle10km = L.circle([h.enlem, h.boylam], {
      radius: 10000,
      color: renk,
      weight: 1,
      opacity: 0.45,
      fillColor: renk,
      fillOpacity: 0.05,
      dashArray: '8,8',
    });

    circle3km.addTo(zoneLayer);
    circle10km.addTo(zoneLayer);

    // Çember etiketleri (küçük tooltip)
    circle3km.bindTooltip('3 km', { permanent: false, className: 'zone-tooltip', opacity: 0.85 });
    circle10km.bindTooltip('10 km', { permanent: false, className: 'zone-tooltip', opacity: 0.85 });

    L.marker([h.enlem, h.boylam], { icon })
      .bindPopup(popupHtml, { maxWidth: 300 })
      .addTo(markerLayer);
  });
}

// Çember katmanını aç/kapat
export function toggleZones() {
  if (!zoneLayer || !map) return false;
  if (zonesVisible) {
    map.removeLayer(zoneLayer);
    zonesVisible = false;
  } else {
    zoneLayer.addTo(map);
    zonesVisible = true;
  }
  return zonesVisible;
}

export function getZonesVisible() { return zonesVisible; }

// Kullanıcı konumunu haritada göster
export function showUserLocation(lat, lng) {
  const icon = L.divIcon({
    className: '',
    html: `<div class="user-location-marker"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
  }
}

export function panToUser(lat, lng) {
  map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { animate: true, duration: 1.2 });
}

export function getMap() { return map; }
