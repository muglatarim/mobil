/**
 * app.js - Ana uygulama giriş noktası
 */
import { loadAllData, getStats, getGuncelleme } from './data.js';
import { initMap, loadMahalleLayer, loadHastalikMarkers, toggleZones } from './map.js';
import { startTracking, stopTracking, isLocationTracking, setGeoLayers } from './location.js';
import { requestNotificationPermission, showToast } from './notify.js';

// Service Worker kaydı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Yükleme ekranını kaldır
function hideLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 500);
}

// İstatistik pillerini güncelle
function updateStats() {
  const stats = getStats();
  document.getElementById('stat-karantina').textContent = `${stats.karantinaCount} Karantina Mahalle`;
  document.getElementById('stat-hastalik').textContent = `${stats.hastalikCount} Hastalık Mihrakı`;
  const guncelleme = getGuncelleme();
  if (guncelleme) {
    const el = document.getElementById('guncelleme');
    if (el) el.textContent = `Son güncelleme: ${guncelleme}`;
  }
}

// Konum butonu
function handleLocateButton() {
  const btn = document.getElementById('btn-locate');
  if (!btn) return;

  if (isLocationTracking()) {
    stopTracking();
    btn.classList.remove('locating');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>Konumum`;
    document.getElementById('loc-info').textContent = '';
    showToast('Konum takibi durduruldu', 'info', 2000);
  } else {
    requestNotificationPermission();
    const started = startTracking();
    if (started) {
      btn.classList.add('locating');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>Takip Aktif`;
    }
  }
}

// Lejant toggle
function initLegend() {
  const toggleBtn = document.getElementById('legend-toggle');
  const body = document.getElementById('legend-body');
  if (!toggleBtn || !body) return;
  toggleBtn.addEventListener('click', () => {
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? 'flex' : 'none';
    toggleBtn.querySelector('.legend-arrow').textContent = hidden ? '▲' : '▼';
  });
}

// Ana başlatma
async function init() {
  try {
    // Veri yükle
    document.querySelector('.loading-text').textContent = 'Veriler yükleniyor...';
    await loadAllData();

    // Haritayı başlat
    document.querySelector('.loading-text').textContent = 'Harita oluşturuluyor...';
    initMap('map');

    // Mahalle katmanını yükle
    const geoLayer = loadMahalleLayer(props => {
      // Mahalle tıklandığında bilgi panelini güncelle (opsiyonel)
    });
    setGeoLayers(geoLayer);

    // Hastalık markerlarını yükle
    loadHastalikMarkers();

    // İstatistikleri güncelle
    updateStats();

    // Lejantı başlat
    initLegend();

    // Buton olayları
    document.getElementById('btn-locate')?.addEventListener('click', handleLocateButton);

    // Çember (zone) toggle butonu
    document.getElementById('btn-zones')?.addEventListener('click', function() {
      const visible = toggleZones();
      this.classList.toggle('active', visible);
      this.textContent = visible ? '✔️ Alanlar' : '⭕ Alanlar';
      showToast(visible ? '3km/10km alanlar gösteriliyor' : 'Alanlar gizlendi', 'info', 1500);
    });

    // Alt panel handle
    document.getElementById('panel-handle')?.addEventListener('click', () => {
      document.getElementById('info-panel')?.classList.toggle('open');
    });

    // Haritaya tıklayınca paneli kapat
    document.getElementById('map')?.addEventListener('click', () => {
      document.getElementById('info-panel')?.classList.remove('open');
    });

    hideLoading();
    showToast('Harita yüklendi ✓', 'success', 2000);

  } catch (err) {
    console.error('Başlatma hatası:', err);
    document.querySelector('.loading-text').textContent = 'Yükleme hatası. Sayfayı yenileyin.';
    document.querySelector('.spinner').style.borderTopColor = '#ef4444';
  }
}

// DOMContentLoaded sonrası başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
