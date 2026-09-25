// Service worker: maakt de app offline bruikbaar. Verhoog VERSION na elke update.
const VERSION = 'hoofdsteden-v2';
const FILES = [
  './', './index.html', './style.css', './app.js', './data.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/icon-maskable-512.png',
  './fonts/baloo-2-latin-500-normal.woff2', './fonts/baloo-2-latin-600-normal.woff2',
  './fonts/baloo-2-latin-700-normal.woff2', './fonts/baloo-2-latin-800-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
