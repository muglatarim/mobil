/**
 * app.js - Ana uygulama giriş noktası
 */
import { loadAllData, getStats, getGuncelleme, getUniqueDiseases } from './data.js';
import { db } from './firebase-config.js';
import { initMap, loadMahalleLayer, loadHastalikMarkers, toggleZones, applyDiseaseFilter, getMap } from './map.js';
import { startTracking, stopTracking, isLocationTracking, setGeoLayers } from './location.js';
import { requestNotificationPermission, showToast, setSwRegistration, getNotificationStatus } from './notify.js';

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
function updateStats(filteredStats = null) {
  const stats = filteredStats || getStats();
  const karStat = document.getElementById('stat-karantina');
  const hasStat = document.getElementById('stat-hastalik');
  if (karStat) karStat.textContent = `${stats.karantinaCount} Karantina Mahalle`;
  if (hasStat) hasStat.textContent = `${stats.hastalikCount} Hastalık Mihrakı`;
  
  const guncelleme = getGuncelleme();
  if (guncelleme && !filteredStats) {
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
  // Varsayılan banner'ı engelle
  e.preventDefault();
  deferredPrompt = e;
  
  // Bilgi sekmesindeki kurulum butonu göster
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) installBtn.style.display = 'block';
  console.log('[PWA] Kurulum istemi yakalandı.');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) installBtn.style.display = 'none';
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
        if (frame) frame.src = 'https://iboo48.github.io/desteklemeler/';
      }

      // Tabları güncelle
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      views.forEach(v => {
        v.classList.toggle('active', v.dataset.view === target);
      });

      // Toolbar ve Harita bileşenlerini yönet
      const filterCont = document.getElementById('disease-filter-panel');
      const btnLocate = document.getElementById('btn-locate');
      const mapCont = document.getElementById('map-container');
      const isHaritaVisible = (target === 'harita');
      
      if (filterCont) filterCont.style.display = isHaritaVisible ? 'block' : 'none';
      if (btnLocate) btnLocate.style.display = isHaritaVisible ? 'block' : 'none';
      
      // Harita konteynerini (ve Leaflet kontrollerini) gizle/göster
      if (mapCont) {
        if (isHaritaVisible) {
          mapCont.style.visibility = 'visible';
          mapCont.style.height = 'auto'; // Veya orijinal yüksekliği
          mapCont.style.position = 'relative';
        } else {
          mapCont.style.visibility = 'hidden';
          mapCont.style.height = '0';
          mapCont.style.overflow = 'hidden';
          mapCont.style.position = 'absolute';
        }
      }

      // Harita sekmesine dönünce Leaflet'i yenile
      if (isHaritaVisible) {
        const map = getMap();
        if (map) {
          setTimeout(() => map.invalidateSize(), 150);
        }
      }
    });
  });

  // BAŞLANGIÇ DURUMU: İlk açılışta harita harici butonları ve haritayı gizle
  const initialActiveTab = document.querySelector('.nav-tab.active')?.dataset.tab;
  const isHaritaInitial = initialActiveTab === 'harita';
  
  const filterCont = document.getElementById('disease-filter-panel');
  const btnLocate = document.getElementById('btn-locate');
  const mapCont = document.getElementById('map-container');
  
  if (filterCont) filterCont.style.display = isHaritaInitial ? 'block' : 'none';
  if (btnLocate) btnLocate.style.display = isHaritaInitial ? 'block' : 'none';

  if (mapCont && !isHaritaInitial) {
    mapCont.style.visibility = 'hidden';
    mapCont.style.height = '0';
    mapCont.style.overflow = 'hidden';
    mapCont.style.position = 'absolute';
  }
}

import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Duyuruları yükle (Realtime Database'den)
export async function loadDuyurular() {
  const container = document.getElementById('duyuru-list');
  if (!container) return;

  try {
    const snapshot = await get(ref(db, "duyurular"));
    
    if (!snapshot.exists()) {
      container.innerHTML = `<div class="duyuru-bos">Henüz duyuru bulunmamaktadır.</div>`;
      return;
    }

    const duyurular = [];
    snapshot.forEach((child) => {
      duyurular.push({ id: child.key, ...child.val() });
    });

    // Tarihe göre azalan sırala (Yeni en üstte)
    duyurular.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));

    container.innerHTML = duyurular
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
  } catch (err) {
    console.error('Duyuru yukleme hatasi (RTDB):', err);
    container.innerHTML = `<div class="duyuru-bos">Duyurular yüklenirken bir hata oluştu.</div>`;
  }
}


function formatTarih(tarihStr) {
  if (!tarihStr) return 'Devam Ediyor';
  const d = new Date(tarihStr);
  if (isNaN(d.getTime())) return 'Devam Ediyor';
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
        const currentStatus = getNotificationStatus();
        if (currentStatus === 'granted') {
          // Zaten izin verilmişse test uyarısı gönder (kullanıcıya çalıştığını kanıtla)
          import('./notify.js').then(m => {
            m.sendNotification('🔔 Bildirimler Aktif', 'Hastalık haritası bildirimleriniz başarıyla çalışıyor.');
            m.showToast('Test bildirimi gönderildi', 'success');
          });
        } else {
          const granted = await requestNotificationPermission();
          updateNotifButton(granted);
          if (granted) {
             import('./notify.js').then(m => m.sendNotification('✅ Bildirimler Açıldı', 'Karantina uyarılarını artık alacaksınız.'));
          }
        }
      } else if (b.action === 'install') {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`[PWA] Kurulum tercihi: ${outcome}`);
          deferredPrompt = null;
          const installBtn = document.getElementById('btn-pwa-install');
          if (installBtn) installBtn.style.display = 'none';
        }
      }
    });
  });
}

// Bildirim butonu metnini ve stilini güncelle
function updateNotifButton(isGranted = null) {
  const btn = document.getElementById('btn-allow-notif');
  const helpText = document.getElementById('notif-help-text');
  if (!btn) return;

  const status = isGranted === true ? 'granted' : (isGranted === false ? 'denied' : getNotificationStatus());
  
  if (status === 'granted') {
    btn.textContent = '🔔 Bildirimler: AKTİF';
    btn.style.background = 'linear-gradient(135deg, #059669, #10b981)';
    if (helpText) helpText.style.display = 'block';
  } else if (status === 'denied') {
    btn.textContent = '🔕 Bildirimler: ENGELLENDİ';
    btn.style.background = 'linear-gradient(135deg, #94a3b8, #64748b)';
    if (helpText) helpText.style.display = 'block';
  } else {
    btn.textContent = '🔔 Bildirimleri Etkinleştir';
    btn.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    if (helpText) helpText.style.display = 'none';
  }
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
    updateNotifButton();
    
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
        const counts = applyDiseaseFilter(e.target.value);
        updateStats({
          karantinaCount: counts.mahalleCount,
          hastalikCount: counts.markerCount
        });
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
