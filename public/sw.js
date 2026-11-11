const APP_CACHE = 'office-ops-app-v1';
const IMAGE_CACHE = 'office-ops-images-v1';
const DATA_CACHE = 'office-ops-data-v1';

const CACHEABLE_API_PREFIXES = [
  '/api/photos/all-rooms',
  '/api/photos/room/',
  '/api/training/knowledge',
  '/api/guides',
  '/api/tasks',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      return cache.addAll(['/']).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([APP_CACHE, IMAGE_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!validCaches.has(key)) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. Uploaded Reference & Completion Images: Network-first with Cache fallback,
  //    or Cache-first when offline, always caching successful image responses.
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true });
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.ok) {
            cache.put(req, networkRes.clone());
            return networkRes;
          }
          if (cached) return cached;
          return networkRes;
        } catch {
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline and image not cached' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
    );
    return;
  }

  // 2. Read-only API JSON endpoints (text content, guides, room photo metadata):
  //    Network-first so cross-device updates stay fresh, falling back to cache offline.
  if (CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.ok) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
    );
    return;
  }

  // 3. App Shell & Static Assets (HTML, JS, CSS): Network-first with cache fallback
  if (req.mode === 'navigate' || url.pathname === '/' || /\.(js|css|woff2?|svg|png|jpg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(APP_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.ok) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') {
            const shell = await cache.match('/');
            if (shell) return shell;
          }
          throw new Error('Offline and resource not cached');
        }
      })
    );
  }
});
