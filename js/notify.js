// Push an den Schenker (ntfy.sh), wenn das Brautpaar spielt: Start, je Schatz, Ende. Je Runde jedes Ereignis höchstens einmal.
// Fire-and-forget: Fehler werden geschluckt, das Spiel wartet nie. ?debug=1 / ?nonotify=1: nur console.info, nichts senden.
// ?notifytest=1 sendet einmal eine Testnachricht. Versand als JSON an die Wurzel-URL (UTF-8 sicher, keine Header → kein CORS-Preflight).
// Muss in main.js VOR state.js importiert werden: state.js entfernt ?reset=… aus der URL.
const TOPIC = 'lab7x7-mf-4r1ohf893486pdda';
const KEY = 'hochzeit-labyrinth-notify-v1';   // { round, id, sent: [...] }
const params = new URLSearchParams(location.search);
const quiet = params.get('debug') === '1' || params.get('nonotify') === '1';

if (params.get('reset') === 'all') try { localStorage.removeItem(KEY); } catch {}

const device = () => {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  return 'Desktop';
};

function send(title, message, tag) {
  if (quiet) return console.info('[notify]', title, '–', message);
  if (!navigator.onLine) return;
  try {
    fetch('https://ntfy.sh/', { method: 'POST', keepalive: true, body: JSON.stringify({ topic: TOPIC, title, message, tags: [tag] }) }).catch(() => {});
  } catch {}
}

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { round: 0, sent: [] }; } catch { return { round: 0, sent: [] }; } };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

/** event: 'start' ({ ar }), 'card' ({ k, title }), 'end'. 'start' beginnt eine neue Runde, wenn die aktuelle schon gestartet war. */
export function notify(event, data = {}) {
  try {
    const s = read();
    if (event === 'start' && (!s.round || s.sent.includes('start'))) Object.assign(s, { round: (s.round || 0) + 1, id: Date.now().toString(36), sent: [] });
    if (!s.round) s.round = 1;   // Spiel lief schon vor diesem Update: zählt als Runde 1
    const id = event === 'card' ? 'card' + data.k : event;
    if (s.sent.includes(id)) return;
    s.sent.push(id); write(s);
    const r = s.round > 1 ? ` (Runde ${s.round})` : '';
    const name = data.k < 4 ? `${data.k + 1}. Schatz` : 'Hauptschatz';
    const [title, msg, tag] = event === 'start' ? ['Spiel gestartet', `Mark & Fiona haben das Spiel gestartet 🎉 (${data.ar ? 'mit' : 'ohne'} Kamera, ${device()})`, 'tada']
      : event === 'card' ? [`${name} gefunden`, `${name} gefunden: ${data.title}`, 'gift']
      : ['Alle Schätze gefunden! 🏆', 'Mark & Fiona haben alle 5 Schätze gefunden 🏆', 'trophy'];
    send(title + r, msg + r, tag);
  } catch {}
}

if (params.get('notifytest') === '1') {
  send('Test', 'Test: Benachrichtigung funktioniert ✅', 'white_check_mark');
  params.delete('notifytest');   // Reload sendet nicht nochmal
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
}
