const CACHE_NAME = 'hastalik-haritasi-v11';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/map.js',
  './js/location.js',
  './js/data.js',
  './js/notify.js',
  './icons/gthbLogo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/duyurular.json',
  './data/hastaliklar.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-pip@1.1.0/leaflet-pip.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(err => console.warn('Cache error:', err))
    )
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Network-First for data/js, Cache-First for rest ───────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
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
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Push bildirimi al (sunucu tarafından gönderildiğinde) ────────────────────
self.addEventListener('push', event => {
  let data = { title: '⚠️ Karantina Uyarısı', body: 'Karantina bölgesine girdiniz!' };
  if (event.data) {
    try { data = event.data.json(); } catch { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'karantina-uyari',
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 600],
      silent: false,
      data: { url: './' }
    })
  );
});

// ── Konum kontrolü ve bildirim gönderme (app client'tan mesaj alır) ──────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'KARANTINA_ALERT') {
    const { mahalle, ilce, kisitlamaTipi, hastalik } = event.data;
    self.registration.showNotification(`⚠️ Karantina: ${mahalle}`, {
      body: `${kisitlamaTipi} bölgesine girdiniz.\nHastalık: ${hastalik}\nİlçe: ${ilce}`,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: `karantina-${mahalle}`,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 600],
      silent: false,
      renotify: true,
      data: { url: './' }
    });
  }
});

// ── Bildirime tıklandığında uygulamayı aç ────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Zaten açık pencere varsa odaklan
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni pencere aç
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
