// CorePokerGroup Service Worker
const CACHE_NAME = 'corepoker-v24';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache the app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function() {
        // If some assets fail to cache, still install
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for the app/HTML (so the newest version loads when online),
// cache-first for static assets (icons/manifest). Falls back to cache when offline.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  const req = event.request;
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTML) {
    // Network-first: always try to get the freshest app, fall back to cache offline
    event.respondWith(
      fetch(req).then(function(response) {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, copy); });
        }
        return response;
      }).catch(function() {
        return caches.match(req).then(function(c) { return c || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Cache-first for everything else (icons, manifest)
  event.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(response) {
        if (response && response.status === 200 && req.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, copy); });
        }
        return response;
      }).catch(function() { return cached; });
    })
  );
});
