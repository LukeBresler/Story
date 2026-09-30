// Offline support: network-first for pages, stale-while-revalidate for assets.
const CACHE = 'e37-v1';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/main.js', 'js/config.js', 'js/env.js', 'js/game.js', 'js/herd.js', 'js/render.js',
  'js/sprites.js', 'js/ui.js', 'js/dev.js', 'js/audio.js', 'js/icons.js', 'js/storage.js', 'js/util.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
