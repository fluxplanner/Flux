/* ── FLUX PLANNER · Service Worker — network-first fix ── */
const STATIC = 'flux-static-v45';
/** Directory of this script (e.g. /Fluxplanner/ or /) — works on GitHub Pages and local dev */
const APP_BASE = self.location.pathname.replace(/\/[^/]+$/, '/');
const APP_ORIGIN = self.location.origin;
const INDEX_HTML = APP_ORIGIN + APP_BASE + 'index.html';

const PRECACHE = [
  APP_ORIGIN + APP_BASE,
  INDEX_HTML,
  APP_ORIGIN + APP_BASE + 'manifest.json',
];

// On install — precache with no-store so install never picks a stale index from HTTP cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC)
      .then(c =>
        Promise.all(
          PRECACHE.map(url =>
            fetch(url, { cache: 'no-store' }).then(res => {
              if (!res.ok) throw new Error('precache failed ' + url + ' ' + res.status);
              return c.put(url, res);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// On activate — delete old caches (not the current one), claim all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCacheableScheme(url) {
  try {
    return /^https?:$/i.test(new URL(url).protocol);
  } catch (_) {
    return false;
  }
}

// Fetch strategy: NETWORK FIRST for app files, cache only as fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Cache API only supports http(s). Skip chrome-extension:, chrome:, blob:, etc.
  if (!isCacheableScheme(url)) return;

  // Never intercept: API calls, Supabase, Groq, Google, POST requests
  if (
    e.request.method !== 'GET' ||
    url.includes('supabase.co') ||
    url.includes('groq.com') ||
    url.includes('googleapis.com') ||
    url.includes('fonts.g') ||
    url.includes('cdn.jsdelivr')
  ) return;

  // Top-level navigations to /repo/ have no ".html" in the URL — must be network-first too
  const isDocument =
    e.request.mode === 'navigate' || e.request.destination === 'document';
  const isAppFile =
    isDocument ||
    url.includes('.html') ||
    url.includes('.js') ||
    url.includes('.css');

  if (isAppFile) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          // Cache the fresh response
          if (res && res.status === 200 && isCacheableScheme(url)) {
            const clone = res.clone();
            caches.open(STATIC).then(c =>
              c.put(e.request, clone).catch(() => {})
            );
          }
          return res;
        })
        .catch(() => {
          // Network failed — use cache as offline fallback
          return caches.match(e.request)
            .then(cached => cached || caches.match(INDEX_HTML));
        })
    );
    return;
  }

  // For everything else (images, fonts) — cache first is fine
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && isCacheableScheme(url)) {
          const clone = res.clone();
          caches.open(STATIC).then(c =>
            c.put(e.request, clone).catch(() => {})
          );
        }
        return res;
      }).catch(() => caches.match(INDEX_HTML));
    })
  );
});
