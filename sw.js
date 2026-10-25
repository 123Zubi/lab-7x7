// Offline-Hilfe: Seite, Skripte und CSS immer frisch vom Netz (Cache nur bei Netzfehler, damit nie alte und neue Module gemischt werden),
// Bilder/Daten network-first mit 3,5-s-Rennen, CDN-Skripte cache-first.
// Neue Datei unter app/ → in SHELL eintragen. Bei Änderungen an dieser Datei VERSION erhöhen.
const VERSION = '2026-10-25-4';
const PREFIX = 'hl-'; // eigener Präfix: auf demselben Origin laufen andere Apps (z. B. /Lab-7x7_Kitschig/ mit 'kitschig-…') – deren Caches nie anfassen
const APP = PREFIX + 'app-' + VERSION;
const CDN = PREFIX + 'cdn-v1'; // unversioniert: die CDN-URLs sind versionsfest, der Cache soll Redeploys überleben
const CDN_HOSTS = ['aframe.io', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']; // Google Fonts: zur Laufzeit cache-first
const NET_WAIT = 3500; // nur Bilder/Daten: so lange auf das Netz warten, bevor die Cache-Kopie genommen wird
const SHELL = [
  './', 'index.html', 'css/style.css',
  'js/main.js', 'js/ar.js', 'js/content.js', 'js/questions.js', 'js/couple3d.js', 'js/fallback.js', 'js/quiz.js', 'js/route.js', 'js/sound.js', 'js/state.js', 'js/setup.js', 'js/notify.js',
  'assets/board.jpg', 'assets/target.jpg', 'assets/target-schmuck.jpg', 'assets/target-tiles.json', 'targets.mind',
  // UI-Bilder und Karten (docs/ASSETS.md). Neue Datei → hier eintragen und VERSION erhöhen.
  'assets/ui/bg-paper.jpg', 'assets/ui/divider.png', 'assets/ui/chest.webp',
  'assets/ui/icon-weihnachtsmarkt.webp', 'assets/ui/icon-kino.webp', 'assets/ui/icon-dinner.webp', 'assets/ui/icon-spieleabend.webp', 'assets/ui/icon-flitterwochen.webp',
  'assets/ui/start.jpg', 'assets/ui/anleitung.jpg', 'assets/ui/abschluss.jpg', 'assets/ui/joker-5050.png',
  'assets/ui/paar-hallo.png', 'assets/ui/paar-denken.png', 'assets/ui/paar-jubel.png', 'assets/ui/paar-trost.png', 'assets/ui/paar-zeigen.png',
  'assets/ui/figur-steht.png', 'assets/ui/figur-laeuft-1.png', 'assets/ui/figur-laeuft-2.png', 'assets/ui/figur-jubelt.png', 'assets/ui/figur-hinten.png',
  'assets/ui/apple-touch-icon.png', 'assets/ui/icon-192.png', 'assets/ui/icon-512.png', 'favicon.png', 'manifest.webmanifest',
  'assets/cards/weihnachtsmarkt.jpg', 'assets/cards/kino.jpg', 'assets/cards/dinner.jpg', 'assets/cards/spieleabend.jpg', 'assets/cards/flitterwochen.jpg', 'assets/cards/rueckseite.jpg',
];

// Cache-Schlüssel ohne Query, damit ?reset=1, ?debug=1 usw. dieselbe Kopie treffen.
const keyOf = (url) => { const u = new URL(url); u.search = ''; return u.href; };

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // Alles oder nichts: fehlt eine SHELL-Datei, scheitert die Installation und der alte Service Worker samt vollständigem Cache bleibt aktiv.
  e.waitUntil(caches.open(APP).then((c) => Promise.all(SHELL.map(async (p) => {
    const url = new URL(p, self.registration.scope).href;
    const r = await fetch(url, { cache: 'no-cache' });   // nachfragen (304), nicht neu laden: targets.mind hat die Seite meist schon geholt
    if (!r.ok) throw new Error(`SHELL ${p}: ${r.status}`);
    await c.put(keyOf(url), r);
  }))).catch(async (err) => { await caches.delete(APP); throw err; }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => (k.startsWith(PREFIX + 'app-') || k.startsWith(PREFIX + 'cdn-')) && k !== APP && k !== CDN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (CDN_HOSTS.includes(url.hostname)) return e.respondWith(cdnFirst(req));
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate' || req.destination === 'script' || req.destination === 'style') return e.respondWith(fresh(req));
  // Spielbrett-Erkennung (6 MB): aus dem Cache, ohne Netzrennen. Neue Fassung kommt mit neuer VERSION (Installation lädt die SHELL).
  if (url.pathname.endsWith('/targets.mind')) return e.respondWith(caches.open(APP).then((c) => c.match(keyOf(req.url))).then((hit) => hit || networkFirst(e, req)));
  e.respondWith(networkFirst(e, req));
});

async function cdnFirst(req) {
  const c = await caches.open(CDN);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req.url, r.clone()); // ponytail: opaque = Status unbekannt, bei 404 bliebe eine kaputte Kopie (bei versionsfesten URLs unwahrscheinlich)
  return r;
}

// Code und Seite: am HTTP-Cache vorbei revalidieren, ohne Zeitrennen. Cache-Kopie nur, wenn das Netz gar nicht antwortet.
// Der Cache wird hier bewusst NICHT nachgeschrieben: er bleibt der vollständige Stand einer Installation (eine VERSION),
// sonst könnte offline ein neues main.js neben einem alten content.js liegen.
async function fresh(req) {
  const c = await caches.open(APP), key = keyOf(req.url);
  try {
    // Navigation: neue Anfrage aus der URL (eine navigate-Request mit Optionen wirft in Chrome einen TypeError)
    const r = await fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' }));
    return r.ok ? r : (await c.match(key)) || r;
  } catch (err) {
    const hit = await c.match(key);
    if (hit) return hit;
    throw err;
  }
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
