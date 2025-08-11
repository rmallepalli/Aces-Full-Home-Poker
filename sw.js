// Aces Full Home Poker – service worker
// Cache core shell so the app loads offline after first visit.
const CACHE_NAME = 'aces-full-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Strategy:
// 1) Navigation requests: try network first; if offline, fall back to cached index.html.
// 2) Same-origin GET assets: stale-while-revalidate.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET.
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // App shell for navigations
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Optionally update cache in background
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((netRes) => {
      // Avoid caching opaque errors
      if (netRes && netRes.status === 200 && (netRes.type === 'basic' || netRes.type === 'cors')) {
        cache.put(req, netRes.clone());
      }
      return netRes;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
