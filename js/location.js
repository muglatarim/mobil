/**
 * location.js - Konum takibi ve karantina bölgesi kontrolü
 * leaflet-pip kullanarak point-in-polygon hesabı
 */
import { getGeoJSON } from './data.js';
import { showUserLocation, panToUser, getMap } from './map.js';
import { showKarantinaAlert, clearAlerts, showToast } from './notify.js';

let watchId = null;
let isTracking = false;
let lastMahalle = null;
let geoLayers = null; // leaflet-pip için

// GeoJSON katmanını sakla
export function setGeoLayers(layer) {
  geoLayers = layer;
}

// Point-in-polygon kontrolü - hangi mahalledeyiz
function findCurrentMahalle(lat, lng) {
  if (!geoLayers) return null;
  // leaflet.pip kütüphanesi
  try {
    const results = leafletPip.pointInLayer([lng, lat], geoLayers, true);
    if (results.length > 0) {
      return results[0].feature.properties;
    }
  } catch (e) {
    // leaflet-pip mevcut değilse manuel kontrol et
    console.warn('leaflet-pip hatası:', e);
  }
  return null;
}

// Konum güncellendiğinde çalışır
function onLocationUpdate(position) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;

  // Haritada kullanıcı konumunu güncelle
  showUserLocation(lat, lng);

  // Hangi mahalledeyiz?
  const mahalle = findCurrentMahalle(lat, lng);

  if (mahalle) {
    const mKey = `${mahalle.AD}|${mahalle.ILCEAD}`;

    // Mahalle değiştiyse veya ilk kez girildiyse
    if (mKey !== lastMahalle) {
      lastMahalle = mKey;
      clearAlerts();

      if (mahalle.karantinaAktif && mahalle.karantina?.length > 0) {
        showKarantinaAlert(mahalle.AD, mahalle.ILCEAD, mahalle.karantina);
      }
    }
  } else {
    // Muğla sınırları dışında veya bilinmeyen bölge
    if (lastMahalle !== null) {
      clearAlerts();
      lastMahalle = null;
    }
  }

  // Durum çubuğunu güncelle
  const locInfo = document.getElementById('loc-info');
  if (locInfo) {
    const mahalleAdi = mahalle ? `${mahalle.AD} / ${mahalle.ILCEAD}` : 'Bölge dışı';
    locInfo.textContent = `📍 ${mahalleAdi}`;
  }
}

function onLocationError(err) {
  let msg = 'Konum alınamadı';
  if (err.code === 1) msg = 'Konum izni reddedildi';
  else if (err.code === 2) msg = 'Konum bilgisi mevcut değil';
  else if (err.code === 3) msg = 'Konum zaman aşımı';
  showToast(msg, 'error');
  stopTracking();
}

// Konum takibini başlat
export function startTracking() {
  if (!navigator.geolocation) {
    showToast('Cihazınız konum özelliğini desteklemiyor', 'error');
    return false;
  }
  if (isTracking) return true;

  // Önce hızlı bir konum al, sonra sürekli takip et
  navigator.geolocation.getCurrentPosition(
    pos => {
      onLocationUpdate(pos);
      panToUser(pos.coords.latitude, pos.coords.longitude);
      showToast('Konum takibi başladı', 'success', 2500);
    },
    onLocationError,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  watchId = navigator.geolocation.watchPosition(
    onLocationUpdate,
    onLocationError,
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000, // 30sn eski konum kabul et
    }
  );

  isTracking = true;
  return true;
}

// Konum takibini durdur
export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  isTracking = false;
  lastMahalle = null;
}

export function isLocationTracking() { return isTracking; }
