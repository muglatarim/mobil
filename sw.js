const CACHE_NAME = 'hastalik-haritasi-v4';
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

// Install: statik dosyaları cache'e al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => console.warn('Cache error:', err));
    })
  );
  self.skipWaiting();
});

// Activate: eski cache'leri temizle ve yeni worker'ı hemen aktif et
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Data JSON'ları için Network-First, diğerleri için Cache-First
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Data JSON'ları veya JS dosyaları: her zaman ağdan al (güncel veri/kod önceliği)
  if (url.pathname.includes('/data/') || (url.pathname.endsWith('.js') && url.pathname.includes('/js/'))) {
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

  // Diğer statik dosyalar: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
