// Service-Worker: hält die App offline vor. Strategie: sofort aus dem Cache antworten,
// im Hintergrund die neue Version holen (Updates wirken beim nächsten Öffnen).
const CACHE = 'truckload-v0.1.1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'css/app.css',
  'css/print.css',
  'js/app.js',
  'js/state.js',
  'js/version.js',
  'js/data/categories.js',
  'js/data/preset-cases.js',
  'js/data/preset-trucks.js',
  'js/model/actions.js',
  'js/model/caseShape.js',
  'js/model/geometry.js',
  'js/model/packer.js',
  'js/model/validate.js',
  'js/store/db.js',
  'js/store/io.js',
  'js/store/repo.js',
  'js/ui/case-editor.js',
  'js/ui/caseStyle.js',
  'js/ui/dom.js',
  'js/ui/inspector.js',
  'js/ui/library.js',
  'js/ui/print.js',
  'js/ui/projection.js',
  'js/ui/truck-editor.js',
  'js/ui/view2d.js',
  'js/ui/view3d.js',
  'vendor/three.module.min.js',
  'vendor/addons/controls/OrbitControls.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, { ignoreSearch: true });
    const fresh = fetch(request)
      .then(res => { if (res.ok) cache.put(request, res.clone()); return res; })
      .catch(() => cached);
    return cached ?? fresh;
  }));
});
