/**
 * app.js - Ana uygulama giriş noktası
 */
import { loadAllData, getStats, getGuncelleme, getUniqueDiseases } from './data.js';
import { initMap, loadMahalleLayer, loadHastalikMarkers, toggleZones, applyDiseaseFilter, getMap } from './map.js';
import { startTracking, stopTracking, isLocationTracking, setGeoLayers } from './location.js';
import { requestNotificationPermission, showToast, setSwRegistration } from './notify.js';

// Service Worker kaydı
let swReg = null;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      swReg = await navigator.serviceWorker.register('./sw.js');
      setSwRegistration(swReg);
    } catch (e) {
      console.warn('SW kayıt hatası:', e);
    }
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
  const karStat = document.getElementById('stat-karantina');
  const hasStat = document.getElementById('stat-hastalik');
  if (karStat) karStat.textContent = `${stats.karantinaCount} Karantina Mahalle`;
  if (hasStat) hasStat.textContent = `${stats.hastalikCount} Hastalık Mihrakı`;
  
  const guncelleme = getGuncelleme();
  if (guncelleme) {
    const el = document.getElementById('guncelleme');
    if (el) el.textContent = `Son güncelleme: ${guncelleme}`;
  }
}

// Hastalık filtresini dinamik doldur
function populateDiseaseFilter() {
  const filterSelect = document.getElementById('disease-filter');
  if (!filterSelect) return;

  const diseases = getUniqueDiseases();
  
  // Mevcut seçenekleri temizle (ilk "Tüm Hastalıklar" hariç)
  filterSelect.innerHTML = '<option value="ALL">Tüm Hastalıklar</option>';

  diseases.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    filterSelect.appendChild(opt);
  });
}

// Konum butonu
function handleLocateButton() {
  const btn = document.getElementById('btn-locate');
  if (!btn) return;

  if (isLocationTracking()) {
    stopTracking();
    btn.classList.remove('locating');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>Konumum`;
    const locInfo = document.getElementById('loc-info');
    if (locInfo) locInfo.textContent = '';
    showToast('Konum takibi durduruldu', 'info', 2000);
  } else {
    requestNotificationPermission().then(granted => {
      if (!granted) showToast('Bildirim izni verilmedi – uyarılar ekranda gösterilecek', 'warning', 3500);
    });
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
  if (toggleBtn && body) {
    toggleBtn.addEventListener('click', () => {
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'flex' : 'none';
      const arrow = toggleBtn.querySelector('.legend-arrow');
      if (arrow) arrow.textContent = hidden ? '▲' : '▼';
    });
  }

  // Filtre paneli toggle
  const filterToggle = document.getElementById('filter-toggle');
  const filterBody = document.getElementById('filter-body');
  if (filterToggle && filterBody) {
    filterToggle.addEventListener('click', () => {
      const hidden = filterBody.style.display === 'none';
      filterBody.style.display = hidden ? 'block' : 'none';
      const arrow = filterToggle.querySelector('.panel-arrow');
      if (arrow) arrow.textContent = hidden ? '▲' : '▼';
    });
  }
}

let isMapReady = false;
let desteklemeLoaded = false;
let deferredPrompt = null;

// PWA Kurulum Yönetimi
window.addEventListener('beforeinstallprompt', (e) => {
  // Varsayılan banner'ı engelle (isteğe bağlı, ama butonu göstermek için yakalamalıyız)
  e.preventDefault();
  deferredPrompt = e;
  
  // Bilgi sekmesindeki kurulum kartını göster
  const installCard = document.getElementById('pwa-install-card');
  if (installCard) installCard.style.display = 'block';
  console.log('[PWA] Kurulum istemi yakalandı.');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installCard = document.getElementById('pwa-install-card');
  if (installCard) installCard.style.display = 'none';
  showToast('✅ Uygulama başarıyla yüklendi!', 'success', 3000);
});

// Sekmeler arası geçiş
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const views = document.querySelectorAll('.view-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Harita sekmesine tıklandığında veri kontrolü
      if (target === 'harita' && !isMapReady) {
        showToast('📍 Harita verileri yükleniyor, lütfen bekleyin...', 'info', 3000);
      }

      // Destekleme iframe yükle (Lazy)
      if (target === 'destekleme' && !desteklemeLoaded) {
        desteklemeLoaded = true;
        const frame = document.getElementById('destekleme-frame');
        if (frame) frame.src = 'https://muglatarim.github.io/desteklemeler/';
      }

      // Tabları güncelle
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      views.forEach(v => {
        v.classList.toggle('active', v.dataset.view === target);
      });

      // Toolbar bileşenlerini yönet
      const filterCont = document.getElementById('disease-filter-panel');
      const btnLocate = document.getElementById('btn-locate');
      const isHaritaVisible = (target === 'harita');
      
      if (filterCont) filterCont.style.display = isHaritaVisible ? 'block' : 'none';
      if (btnLocate) btnLocate.style.display = isHaritaVisible ? 'block' : 'none';

      // Harita sekmesine dönünce Leaflet'i yenile
      if (isHaritaVisible) {
        const map = getMap();
        if (map) {
          setTimeout(() => map.invalidateSize(), 150);
        }
      }
    });
  });

  // BAŞLANGIÇ DURUMU: İlk açılışta harita harici butonları gizle
  const initialActiveTab = document.querySelector('.nav-tab.active')?.dataset.tab;
  const isHaritaInitial = initialActiveTab === 'harita';
  
  const filterCont = document.getElementById('disease-filter-panel');
  const btnLocate = document.getElementById('btn-locate');
  
  if (filterCont) filterCont.style.display = isHaritaInitial ? 'block' : 'none';
  if (btnLocate) btnLocate.style.display = isHaritaInitial ? 'block' : 'none';
}

// Duyuruları yükle
export async function loadDuyurular() {
  const container = document.getElementById('duyuru-list');
  if (!container) return;

  const localData = localStorage.getItem('duyurular');
  let duyurular = [];

  if (localData) {
    try { duyurular = JSON.parse(localData); } catch {}
  }

  if (duyurular.length === 0) {
    try {
      const resp = await fetch('./data/duyurular.json');
      duyurular = await resp.json();
    } catch {}
  }

  if (duyurular.length === 0) {
    container.innerHTML = `<div class="duyuru-bos">Henüz duyuru bulunmamaktadır.</div>`;
    return;
  }

  container.innerHTML = duyurular
    .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
    .map(d => `
      <div class="duyuru-card ${d.oncelik || ''}">
        <div class="duyuru-header">
          <span class="duyuru-kategori">${d.kategori || 'Genel'}</span>
          <span class="duyuru-tarih">${formatTarih(d.tarih)}</span>
        </div>
        <h3 class="duyuru-baslik">${d.baslik}</h3>
        <p class="duyuru-icerik">${d.icerik}</p>
        ${d.link ? `<a class="duyuru-link" href="${d.link}" target="_blank">➜ Devamını Oku</a>` : ''}
      </div>
    `).join('');
}

function formatTarih(tarihStr) {
  if (!tarihStr) return '';
  const d = new Date(tarihStr);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Sayfa içi navigasyon yardımcıları (Hero butonları için)
function bindNavButtons() {
  const bindings = [
    { id: 'hero-btn-harita', target: 'harita' },
    { id: 'hero-btn-destek', target: 'destekleme' },
    { id: 'btn-kupe-buyukbas', url: 'https://www.turkiye.gov.tr/gtvh-kupe-ile-buyukbas-hayvan-sorgulama' },
    { id: 'btn-kupe-kucukbas', url: 'https://www.turkiye.gov.tr/gtvh-kupe-ile-kucukbas-hayvan-sorgulama' },
    { id: 'btn-wv-destek-open', url: 'https://muglatarim.github.io/desteklemeler/' },
    { id: 'btn-allow-notif', action: 'notif' },
    { id: 'btn-pwa-install', action: 'install' }
  ];

  bindings.forEach(b => {
    const el = document.getElementById(b.id);
    if (!el) return;
    el.addEventListener('click', async () => {
      if (b.target) {
        const tab = document.querySelector(`.nav-tab[data-tab="${b.target}"]`);
        if (tab) tab.click();
      } else if (b.url) {
        window.open(b.url, '_blank');
      } else if (b.action === 'notif') {
        const { requestNotificationPermission } = await import('./notify.js');
        requestNotificationPermission();
      } else if (b.action === 'install') {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`[PWA] Kurulum tercihi: ${outcome}`);
          deferredPrompt = null;
          const installCard = document.getElementById('pwa-install-card');
          if (installCard) installCard.style.display = 'none';
        }
      }
    });
  });
}

// Global scope ReferenceError önleyici (Eski kodlardan kalma hataları engellemek için)
window.showPanel = function() { console.warn('showPanel çağrıldı (kaldırıldı)'); };

// Ana başlatma
async function init() {
  console.log('[Init] Uygulama başlatılıyor...');
  const loadingText = document.querySelector('.loading-text');
  
  // 1. AŞAMA: Öncelikli UI Elemanlarını Yükle
  try {
    if (loadingText) loadingText.textContent = 'Arayüz hazırlanıyor...';
    
    // Sekmeleri ve butonları başlat
    initTabs();
    initLegend();
    bindNavButtons();
    
    // Yükleme ekranını hemen kapat (UI İskeleti Hazır)
    hideLoading();
    console.log('[Init] Ana ekran gösteriliyor.');

    // Duyuruları yükle (Arka plan / Paralel)
    loadDuyurular().catch(e => console.warn('[Init] Duyuru hatası:', e));
    
  } catch (err) {
    console.error('[Init] Kritik başlatma hatası:', err);
    hideLoading(); 
  }

  // 2. AŞAMA: Harita Verileri (Arka Plan)
  try {
    console.log('[Init] Harita verileri arka planda yükleniyor...');
    
    // Verileri çek (25MB)
    await loadAllData();
    console.log('[Init] Harita verileri indirildi.');

    // Harita katmanlarını oluştur
    initMap('map');
    const geoLayer = loadMahalleLayer(() => {});
    setGeoLayers(geoLayer);
    loadHastalikMarkers();
    
    updateStats();
    populateDiseaseFilter();
    isMapReady = true;
    console.log('[Init] Harita katmanları hazır.');

    // Filtre olaylarını bağla
    const filterSelect = document.getElementById('disease-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        if (!isMapReady) return;
        applyDiseaseFilter(e.target.value);
        showToast(`${e.target.value === 'ALL' ? 'Tüm hastalıklar' : e.target.value} filtrelendi`, 'info', 1500);
      });
    }

    // Buton olayları
    document.getElementById('btn-locate')?.addEventListener('click', handleLocateButton);

    // Haritaya tıklayınca panelleri kapat
    document.getElementById('map')?.addEventListener('click', () => {
      const filterBody = document.getElementById('filter-body');
      if (filterBody) {
        filterBody.style.display = 'none';
        const arrow = document.querySelector('#filter-toggle .panel-arrow');
        if (arrow) arrow.textContent = '▼';
      }
    });
    showToast('Harita verileri hazır ✓', 'success', 3000);
  } catch (err) {
    console.warn('[Init] Harita yükleme hatası:', err);
  }
}

init();
