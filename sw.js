// Offline-Hilfe: App-Dateien network-first (mit Cache-Fallback), CDN-Skripte cache-first.
// Neue Datei unter app/ → in SHELL eintragen. Bei Änderungen an dieser Datei VERSION erhöhen.
const VERSION = '2026-10-20-1';
const APP = 'hl-app-' + VERSION;
const CDN = 'hl-cdn-v1'; // unversioniert: die CDN-URLs sind versionsfest, der Cache soll Redeploys überleben
const CDN_HOSTS = ['aframe.io', 'cdn.jsdelivr.net'];
const NET_WAIT = 3500; // so lange auf das Netz warten, bevor die Cache-Kopie genommen wird
const SHELL = [
  './', 'index.html', 'css/style.css',
  'js/main.js', 'js/ar.js', 'js/content.js', 'js/couple3d.js', 'js/fallback.js', 'js/quiz.js', 'js/route.js', 'js/sound.js', 'js/state.js',
  'assets/board.jpg', 'assets/target.jpg', 'targets.mind',
];

// Cache-Schlüssel ohne Query, damit ?reset=1, ?debug=1 usw. dieselbe Kopie treffen.
const keyOf = (url) => { const u = new URL(url); u.search = ''; return u.href; };

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(APP).then((c) => Promise.all(SHELL.map((p) => {
    const url = new URL(p, self.registration.scope).href;
    return fetch(url, { cache: 'reload' }).then((r) => r.ok && c.put(keyOf(url), r)).catch(() => {}); // fehlende Datei bricht nichts ab
  }))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== APP && k !== CDN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (CDN_HOSTS.includes(url.hostname)) return e.respondWith(cdnFirst(req));
  if (url.origin === location.origin) e.respondWith(networkFirst(e, req));
});

async function cdnFirst(req) {
  const c = await caches.open(CDN);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req.url, r.clone()); // ponytail: opaque = Status unbekannt, bei 404 bliebe eine kaputte Kopie (bei versionsfesten URLs unwahrscheinlich)
  return r;
}

async function networkFirst(e, req) {
  const c = await caches.open(APP), key = keyOf(req.url);
  const cached = await c.match(key);
  const net = fetch(req).then((r) => { if (r.ok) c.put(key, r.clone()); return r.ok || !cached ? r : cached; });
  e.waitUntil(net.catch(() => {})); // Cache wird auch dann aktualisiert, wenn wir schon die Kopie ausgeliefert haben
  if (!cached) return net;
  const slow = new Promise((res) => setTimeout(() => res(cached), NET_WAIT));
  return Promise.race([net.catch(() => cached), slow]);
}
