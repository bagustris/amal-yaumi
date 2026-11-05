const CACHE_VERSION = 'amal-yaumi-v8';

// Explicit list; must mirror every <script>/<link> in index.html.
// Bump CACHE_VERSION whenever any of these change.
const CORE_ASSETS = [
  '.',
  'index.html',
  'style.css',
  'manifest.json',
  'CHANGELOG.md',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'js/storage.js',
  'js/settings.js',
  'js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(CORE_ASSETS.map(async (u) => {
        const res = await fetch(new Request(u, { cache: 'reload' }));
        if (!res.ok) throw new Error(u);
        await cache.put(u, res);
      }))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate with an offline fallback to the app shell.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const stored = cache.put(req, res.clone());
            event.waitUntil(stored);
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
      return cached || network;
    })
  );
});
