// ═══════════════════════════════════════
// AFINITY — Service Worker
// Cache-first para assets, network-first para HTML
// ═══════════════════════════════════════

var CACHE_NAME = 'afinity-v1';
var ASSETS = [
  '/',
  '/index.html'
];

// ── INSTALL ──
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ──
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH ──
// HTML → network primero, cache como fallback (siempre la última versión)
// Resto → cache primero (íconos, etc.)
self.addEventListener('fetch', function(e) {
  var req = e.request;

  // Solo interceptar GET del mismo origen
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  // API de Giphy — nunca cachear
  if (req.url.includes('api.giphy.com')) return;
  if (req.url.includes('nominatim.openstreetmap.org')) return;

  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    // HTML: network-first
    e.respondWith(
      fetch(req)
        .then(function(res) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
          return res;
        })
        .catch(function() {
          return caches.match(req).then(function(cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
  } else {
    // Assets: cache-first
    e.respondWith(
      caches.match(req).then(function(cached) {
        return cached || fetch(req).then(function(res) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
          return res;
        });
      })
    );
  }
});

// ── PUSH NOTIFICATIONS (base lista para el futuro) ──
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {};
  var title = data.title || 'Afinity';
  var options = {
    body: data.body || 'Tenés una nueva notificación',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data.url || '/')
  );
});
