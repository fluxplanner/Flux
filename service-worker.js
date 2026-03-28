/* ── FLUX PLANNER · Service Worker — network-first fix ── */
const CACHE = 'flux-v' + Date.now(); // Force new cache on every deploy
const STATIC = 'flux-static-v8';

const PRECACHE = [
  '/Fluxplanner/',
  '/Fluxplanner/index.html',
  '/Fluxplanner/manifest.json',
];

// On install — cache only the bare minimum, skip waiting immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// On activate — delete ALL old caches immediately, claim all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy: NETWORK FIRST for app files, cache only as fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept: API calls, Supabase, Groq, Google, POST requests
  if (
    e.request.method !== 'GET' ||
    url.includes('supabase.co') ||
    url.includes('groq.com') ||
    url.includes('googleapis.com') ||
    url.includes('fonts.g') ||
    url.includes('cdn.jsdelivr')
  ) return;

  // For HTML, JS, CSS — always try network first, fall back to cache
  const isAppFile = url.includes('.html') || url.includes('.js') || url.includes('.css');

  if (isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache the fresh response
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Network failed — use cache as offline fallback
          return caches.match(e.request)
            .then(cached => cached || caches.match('/Fluxplanner/index.html'));
        })
    );
    return;
  }

  // For everything else (images, fonts) — cache first is fine
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(STATIC).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/Fluxplanner/index.html'));
    })
  );
});
