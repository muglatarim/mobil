/**
 * Service Worker - Hastalık Haritası PWA
 * Offline destek için statik dosyaları ve veri JSON'larını cache'ler
 */
const CACHE_NAME = 'hastalik-haritasi-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-pip@1.1.0/leaflet-pip.min.js',
];

// JS modülleri: network-first (kod güncellenebilir)
const JS_ASSETS = [
  './js/app.js',
  './js/map.js',
  './js/location.js',
  './js/data.js',
  './js/notify.js',
];

const DATA_ASSETS = [
  './data/hastaliklar.json',
  './data/karantina.json',
  './data/mahalleler_karantina.json',
];

// Install: tüm statik dosyaları cache'e al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
        .then(() => cache.addAll(DATA_ASSETS).catch(() => {}));
    })
  );
  self.skipWaiting();
});

// Activate: eski cache'leri temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first (JS + Data), Cache-first (diğer statik)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // JS modülleri: her zaman ağdan al (güncel kod)
  if (path.endsWith('.js') && path.includes('/js/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Data JSON'ları için: network-first (güncel veri önemli)
  if (path.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Diğerleri: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/map.js',
  './js/location.js',
  './js/data.js',
  './js/notify.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-pip@1.1.0/leaflet-pip.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
];

const DATA_ASSETS = [
  './data/hastalıklar.json',
  './data/karantina.json',
  './data/mahalleler_karantina.json',
];

// Install: tüm statik dosyaları cache'e al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Statik dosyaları cache'e al (hata olursa devam et)
      return cache.addAll(STATIC_ASSETS).catch(() => {})
        .then(() => cache.addAll(DATA_ASSETS).catch(() => {}));
    })
  );
  self.skipWaiting();
});

// Activate: eski cache'leri temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first (veri), Network-first (data JSON)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Data JSON'ları için: network-first (güncel veri önemli)
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Diğerleri: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
