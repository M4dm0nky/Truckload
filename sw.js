// Service-Worker: hält die App offline vor. Strategie seit V 0.13.1: Netz zuerst, am HTTP-Cache des
// Browsers vorbei (Nutzerwunsch: „immer den aktuellen Stand laden“). Der Offline-Cache springt nur ein,
// wenn das Netz fehlt, mit einem Fehler antwortet oder länger als NETWORK_TIMEOUT_MS braucht – dann
// läuft der Abruf im Hintergrund weiter und frischt den Cache auf.
// Ein Stand pro Seitenaufruf: Lief bei einem Client ein Abruf in den Timeout, kommen alle weiteren
// Dateien dieses Clients sofort aus dem Cache – sonst mischen sich alte und neue Module.
const CACHE = 'truckload-v0.13.4';
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
  'js/data/case-library.js',
  'js/data/categories.js',
  'js/data/preset-cases.js',
  'js/data/preset-trucks.js',
  'js/model/actions.js',
  'js/model/audioDolly.js',
  'js/model/caseShape.js',
  'js/model/geometry.js',
  'js/model/material.js',
  'js/model/packer.js',
  'js/model/packRules.js',
  'js/model/truss.js',
  'js/model/validate.js',
  'js/store/autosave.js',
  'js/store/db.js',
  'js/store/io.js',
  'js/store/repo.js',
  'js/ui/case-editor.js',
  'js/ui/caseGroups.js',
  'js/ui/caseStyle.js',
  'js/ui/confirmDialog.js',
  'js/ui/dolly-wizard.js',
  'js/ui/dom.js',
  'js/ui/inspector.js',
  'js/ui/instanceMatrix.js',
  'js/ui/labelTexture.js',
  'js/ui/library.js',
  'js/ui/load-wizard.js',
  'js/ui/material.js',
  'js/ui/pack-rules.js',
  'js/ui/print.js',
  'js/ui/projection.js',
  'js/ui/stock-target.js',
  'js/ui/truck-editor.js',
  'js/ui/truss-wizard.js',
  'js/ui/view2d.js',
  'js/ui/zoom2d.js',
  'js/ui/view3d.js',
  'vendor/three.module.min.js',
  'vendor/addons/controls/OrbitControls.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => { degradedClients.clear(); return self.clients.claim(); }));
});

const NETWORK_TIMEOUT_MS = 3000;
const MAX_DEGRADED_CLIENTS = 50;
// Clients (Seitenaufrufe), bei denen das Netz zu langsam war; Schlüssel ist die Client-Id.
const degradedClients = new Set();

// Eigene Funktion (statt inline im fetch-Handler), damit tests/sw.test.js sie ohne Browser prüfen
// kann. `cache: 'no-cache'` lässt den Browser beim Server nachfragen statt seine eigene HTTP-Kopie
// zu nehmen (GitHub Pages schickt max-age=600). Neuer Request aus der URL, weil sich ein
// Navigations-Request nicht mit geänderten Optionen kopieren lässt.
// `opts`: { degraded: Set, clientId: string, waitUntil: fn } – alles optional.
function networkFirst(request, cache, fetchFn = fetch, timeoutMs = NETWORK_TIMEOUT_MS, opts = {}) {
  const { degraded, clientId, waitUntil } = opts;
  const fallback = () => cache.match(request, { ignoreSearch: true });
  const markDegraded = () => {
    if (!degraded || !clientId) return;
    if (degraded.size >= MAX_DEGRADED_CLIENTS) degraded.delete(degraded.values().next().value);
    degraded.add(clientId);
  };
  const run = () => {
    const fromNet = fetchFn(new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => {
        if (res.ok) {
          const put = cache.put(request, res.clone());
          if (waitUntil) waitUntil(put.catch(() => {}));
          return res;
        }
        return fallback().then(cached => cached ?? res);
      });
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = r => { if (!done) { done = true; resolve(r); } };
      const timer = setTimeout(async () => {
        const cached = await fallback();
        if (cached) { markDegraded(); finish(cached); }
      }, timeoutMs);
      fromNet.then(res => { clearTimeout(timer); finish(res); }, async err => {
        clearTimeout(timer);
        const cached = await fallback();
        if (done) return;
        if (cached) finish(cached); else { done = true; reject(err); }
      });
    });
  };
  if (degraded && clientId && degraded.has(clientId)) {
    return fallback().then(cached => cached ?? run());
  }
  return run();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const clientId = event.resultingClientId || event.clientId || '';
  event.respondWith(caches.open(CACHE).then(cache =>
    networkFirst(request, cache, fetch, NETWORK_TIMEOUT_MS,
      { degraded: degradedClients, clientId, waitUntil: p => { try { event.waitUntil(p); } catch { /* Ereignis schon beendet */ } } })));
});
