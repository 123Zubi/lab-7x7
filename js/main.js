// Ablaufsteuerung: Start → (AR | Fallback) → Intro → 4 Stationen (Laufen, Sprechblase, Quiz, Schatz) → Finale → Abschluss.
import { state, save, reset, isDebug } from './state.js';
import { STATIONS, FINALE, INTRO, TOTAL } from './content.js';
import { sound, isMuted, toggleMute } from './sound.js';
import { createQuiz } from './quiz.js';
import { createFallbackStage, coupleSVG } from './fallback.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest/i;
const stageEl = $('#stage');
const panel = $('#panel');
let stage = null;
let quiz = null;
let dotCb = null;
// Das Quiz spricht nur mit diesem Stellvertreter: die Bühne darf mitten im Spiel wechseln (AR ↔ Fallback).
const live = {
  highlightDot: (c) => stage && stage.highlightDot && stage.highlightDot(c),
  onDotTap: (cb) => { dotCb = cb; if (stage && stage.onDotTap) stage.onDotTap(cb); },
};

const show = (name) => ['start', 'game', 'end'].forEach((s) => ($('#screen-' + s).hidden = s !== name));

/* ---------- Konfetti ---------- */
const cv = $('#confetti'), g = cv.getContext('2d');
let parts = [], raf = 0;
const COLORS = ['#f5c542', '#ffe08a', '#e5383b', '#2e9d4f', '#1e6fe0', '#ffffff', '#ff8fb1'];
function confetti(n = 120) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) n = Math.ceil(n / 4);
  const d = devicePixelRatio || 1;
  cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0);
  for (let i = 0; i < n; i++) {
    parts.push({ x: innerWidth * (0.15 + 0.7 * Math.random()), y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 9, vy: -3 - Math.random() * 11, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLORS[i % COLORS.length] });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.y < innerHeight + 20);
  for (const p of parts) {
    p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
    g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : 0;
}

/* ---------- Panel (Sprechblase / Schatz / Quiz) ---------- */
let panelAt = 0; // Klicksperre: Doppeltipp auf den Panel-Button darf nichts im nächsten Panel auslösen
function showPanel(html) {
  panelAt = performance.now();
  panel.innerHTML = html;
  panel.hidden = false;
  panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
}
const hidePanel = () => { panel.hidden = true; panel.innerHTML = ''; };
const card = (html, label) => new Promise((res) => {
  showPanel(`${html}<button class="btn btn-gold panel-btn">${label}</button>`);
  panel.querySelector('.panel-btn').onclick = () => { if (performance.now() - panelAt < 400) return; sound.click(); res(); };
});
const say = (text, label) => card(`<div class="bubble-row"><div class="avatars">${coupleSVG()}</div><div class="bubble"><p>${text}</p></div></div>`, label);

async function treasure(S, i, celebrate) {
  const last = i === 4;
  if (celebrate) {
    sound.fanfare(); stage.cheer(); confetti(140);
    await sleep(1200);
  }
  stage.showChest(...S.pos);
  const line = last ? FINALE.text : 'Hebt dieses Plättchen hoch:';
  const prize = last ? `Hauptgewinn: ${S.name}, ${S.prize} €` : `${S.name}, ${S.prize} €`;
  await card(`<div class="treasure"><div class="t-icon" aria-hidden="true">${S.icon}</div><p class="t-line">${line}</p><p class="t-prize">${prize}</p><p class="t-feld">Feld: ${S.feld}</p></div>`, last ? 'Zum Abschluss' : 'Weiter zur nächsten Station');
}

/* ---------- Fortschrittsanzeige ---------- */
function updateHud() {
  $('#pips').innerHTML = [0, 1, 2, 3, 4].map((i) => {
    const doneP = i < 4 ? state.solved.includes(i) && state.station > i + 1 : state.done;
    const curP = i < 4 ? state.station === i + 1 : state.station === 5;
    return `<li class="${doneP ? 'done' : ''} ${curP ? 'cur' : ''} ${i === 4 ? 'star' : ''}"></li>`;
  }).join('');
  $('#btn-sound').textContent = isMuted() ? '🔇' : '🔊';
}

/* ---------- Spielablauf ---------- */
async function run(resumed) {
  if (state.station === 0) {
    updateHud();
    await say(INTRO, 'Los geht’s');
    state.station = 1; save();
  }
  while (state.station <= 4) {
    const i = state.station - 1, S = STATIONS[i];
    hidePanel(); updateHud();
    await stage.walkTo(i, { instant: resumed });
    if (!state.solved.includes(i)) {
      const midQuiz = state.usingBackup || state.wrong.length || state.gone.length;
      if (!(resumed && midQuiz)) await say(S.bubble, 'Zur Frage');
      await quiz.ask(i);
      stage.highlightDot && stage.highlightDot(null);
      await treasure(S, i, true);
    } else {
      await treasure(S, i, false);
    }
    Object.assign(state, { station: state.station + 1, wrongCount: 0, usingBackup: false, wrong: [], gone: [] });
    save();
    resumed = false;
  }
  hidePanel(); updateHud();
  await stage.walkTo(4, { instant: resumed });
  await say(FINALE.bubble, 'Weiter');
  await treasure(FINALE, 4, true);
  state.done = true; save();
  showEnd();
}

function showEnd() {
  hidePanel();
  if (stage && stage.destroy) stage.destroy();
  retryBtn.hidden = true;
  $('#end-couple').innerHTML = coupleSVG();
  $('#end-list').innerHTML = [...STATIONS, FINALE].map((s) => `<li><span>${s.icon} ${s.name}</span><b>${s.prize} €</b></li>`).join('');
  $('#end-total').textContent = TOTAL + ' €';
  show('end');
  sound.fanfare();
  confetti(180);
  for (let k = 1; k <= 5; k++) setTimeout(() => confetti(90), k * 1800);
}

/* ---------- Start / Modus ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 5000);
}

const named = (name, msg = name) => Object.assign(new Error(msg), { name });
const AR_MSG = {
  NotAllowedError: 'Kamera nicht erlaubt – wir spielen ohne Kamera weiter.',
  NotFoundError: 'Keine Kamera gefunden – wir spielen ohne Kamera weiter.',
  NotReadableError: 'Die Kamera wird gerade von einer anderen App benutzt – wir spielen ohne Kamera weiter.',
  CdnError: 'Die 3D-Welt konnte nicht geladen werden (Internet?) – wir spielen ohne Kamera weiter.',
  TargetError: 'Die Brett-Erkennung konnte nicht geladen werden – wir spielen ohne Kamera weiter.',
  Timeout: 'Der Kamera-Start hat zu lange gedauert – wir spielen ohne Kamera weiter.',
};
const arMsg = (e) => AR_MSG[e && e.name] || 'Die Kamera ist gerade nicht verfügbar – wir spielen ohne Kamera weiter.';

async function tryAr() {
  // 45 s Zeitbudget – die Zeit im Kamera-Dialog zählt nicht: ar.js meldet Phasen, bei 'permission' steht die Uhr,
  // nach erteilter Erlaubnis ('starting') beginnt sie neu.
  const AR_TIMEOUT = 45000, SHOW_CANCEL = 8000;
  const PHASE = { loading: 'Lade 3D-Welt …', permission: 'Bitte Kamera erlauben', starting: 'Kamera wird gestartet …' };
  const STEPS = [[12000, 'Das dauert länger als sonst …'], [30000, 'Fast fertig …']];
  const text = (t) => ($('#loading-text').textContent = t);
  let cancel, timeUp, timers = [], lost = false;
  const cancelled = new Promise((_, rej) => (cancel = () => rej(named('Cancelled', 'abgebrochen'))));
  const timeout = new Promise((_, rej) => (timeUp = () => rej(named('Timeout', 'Zeitüberschreitung'))));
  const disarm = () => { timers.forEach(clearTimeout); timers = []; };
  const arm = () => { disarm(); timers = [setTimeout(timeUp, AR_TIMEOUT), ...STEPS.map(([ms, t]) => setTimeout(() => text(t), ms))]; };
  const onPhase = (p) => {
    if (lost || !PHASE[p]) return;
    text(PHASE[p]);
    if (p === 'permission') disarm(); else arm();
  };
  const btn = $('#btn-cancel-ar');
  btn.className = 'btn btn-ghost';
  text(PHASE.loading);
  $('#loading').hidden = false;
  btn.onclick = cancel;
  const slow = setTimeout(() => (btn.className = 'btn btn-gold'), SHOW_CANCEL);
  arm();
  // Eigener Host-Container: eine zu spät fertige AR-Bühne räumt nur sich selbst weg, nicht den Fallback.
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  stageEl.append(host);
  const ar = import('./ar.js').then((m) => m.createArStage(host, { onPhase, onFatal: arFatal }));
  ar.then((s) => { if (lost) s.destroy && s.destroy(); }, () => {}); // kam sie doch noch: Kamera aus, Szene weg
  try {
    const s = await Promise.race([ar, cancelled, timeout]);
    s.host = host;
    return s;
  } catch (e) {
    lost = true;
    console.warn('AR nicht verfügbar:', e);
    host.remove();
    if (e.name !== 'Cancelled') toast(arMsg(e));
    return null;
  } finally {
    clearTimeout(slow); disarm();
    btn.className = 'btn btn-ghost'; text('Kamera wird gestartet …');
    $('#loading').hidden = true;
  }
}

async function fallbackStage() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  stageEl.append(host);
  const s = await createFallbackStage(host);
  s.host = host;
  return s;
}

/** Bühne einsetzen; beim Wechsel mitten im Spiel steht die neue sofort an der aktuellen Station. */
function useStage(next) {
  const old = stage;
  stage = next;
  document.body.classList.toggle('mode-ar', !!next.isAr);
  if (dotCb && next.onDotTap) next.onDotTap(dotCb);
  if (old) {
    if (state.station > 0) next.walkTo(Math.min(state.station, 5) - 1, { instant: true });
    if (old.destroy) old.destroy();
    if (old.host) old.host.remove();
  }
  state.mode = next.isAr ? 'ar' : 'fallback'; save();
  updateRetry();
}

// AR gewünscht, aber gerade im Fallback (Fehler, Abbruch, Kamera ausgefallen): Kamera nochmal versuchen, Spielstand bleibt.
const retryBtn = document.createElement('button');
retryBtn.className = 'chip';
retryBtn.textContent = '📷 Kamera nochmal versuchen';
retryBtn.style.cssText = 'z-index:6;font:inherit;font-size:13px;cursor:pointer';   // Platz des Brett-Tipps (#hint), erst wenn der weg ist
retryBtn.hidden = true;
$('#screen-game').append(retryBtn);
const updateRetry = () => (retryBtn.hidden = !(state.wantAr && stage && !stage.isAr && !state.done && $('#hint').hidden));
retryBtn.onclick = async () => {
  sound.click();
  retryBtn.hidden = true;
  document.body.classList.add('mode-ar');   // vorher: MindAR misst die Bühne beim Start (Vollbild im AR-Layout)
  const ar = await tryAr();
  if (ar && !state.done) return useStage(ar);
  if (ar) ar.destroy();
  document.body.classList.remove('mode-ar');
  updateRetry();
};

async function arFatal() {
  if (!stage || !stage.isAr) return;
  toast('Die Kamera ist ausgefallen – wir spielen ohne Kamera weiter.');
  const fb = await fallbackStage();
  if (state.done) { fb.destroy(); fb.host.remove(); return; }
  useStage(fb);
}

async function startGame(mode) {
  show('game');
  state.wantAr = mode === 'ar'; save();
  document.body.classList.toggle('mode-ar', mode === 'ar');
  let s = mode === 'ar' ? await tryAr() : null;
  if (!s) {
    s = await fallbackStage();
    $('#hint').hidden = false;
    setTimeout(() => { $('#hint').hidden = true; updateRetry(); }, 9000);
  }
  useStage(s);
  quiz = createQuiz({ root: panel, modal: $('#modal'), stage: live, sound });
  run(state.station > 0).catch((e) => { console.error(e); toast('Etwas ist schiefgelaufen – wir laden neu.'); setTimeout(() => location.reload(), 2500); });
}

function setupDebug() {
  const d = $('#debug');
  d.hidden = false;
  document.body.classList.add('debug-on'); // Brett-Tipp rutscht unter den Debug-Aufklapper
  $('#debug-btns').innerHTML = ['Start', 'S1', 'S2', 'S3', 'S4', 'Ziel', 'Ende'].map((l, n) => `<button data-n="${n}">${l}</button>`).join('') + '<button data-n="x">Reset</button>';
  $('#debug-btns').onclick = (e) => {
    const n = e.target.dataset && e.target.dataset.n;
    if (n === undefined) return;
    const mode = state.mode;
    reset();
    if (n !== 'x') {
      const k = +n;
      Object.assign(state, { mode, station: Math.min(k, 5), solved: Array.from({ length: Math.max(0, Math.min(k, 5) - 1) }, (_, j) => j), done: k === 6 });
      save();
    }
    location.reload();
  };
}

/* ---------- Offline-Hilfe (sw.js) ---------- */
// Dieselben URLs wie in ar.js (AFRAME_SRC/MINDAR_SRC) – bei Versionswechsel dort hier mitziehen.
const CDN_URLS = ['https://aframe.io/releases/1.5.0/aframe.min.js', 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js'];
async function setupOffline() {
  if (!('serviceWorker' in navigator) || !window.caches) return;
  try {
    if (new URLSearchParams(location.search).get('nocache') === '1') { // Testhilfe: SW + Caches entfernen, SW diesmal nicht neu registrieren
      await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
      await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      history.replaceState(null, '', location.pathname);
      return console.info('Offline-Cache geleert');
    }
    await navigator.serviceWorker.register('sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    // CDN-Skripte im Hintergrund holen (no-cors wie das <script>-Tag; Antwort ist opak). Direkt in den Cache, unabhängig davon, ob der SW die Seite schon steuert.
    const cdn = await caches.open('hl-cdn-v1');
    await Promise.all(CDN_URLS.map(async (u) => { if (!(await cdn.match(u))) await cdn.put(u, await fetch(u, { mode: 'no-cors' })); }));
    const ok = await Promise.all([...CDN_URLS, 'targets.mind', 'index.html', 'assets/target.jpg'].map((u) => caches.match(u, { ignoreSearch: true })));
    if (ok.every(Boolean)) $('#offline-ok').hidden = false;
  } catch (e) { console.warn('Offline-Hilfe nicht verfügbar:', e); }
}

function boot() {
  $('#start-couple').innerHTML = coupleSVG();
  if (IN_APP.test(navigator.userAgent)) $('#inapp-note').hidden = false;
  $('#btn-ar').onclick = () => { sound.click(); startGame('ar'); };
  $('#btn-plain').onclick = () => { sound.click(); startGame('fallback'); };
  $('#btn-sound').onclick = () => { toggleMute(); updateHud(); };
  if (isDebug()) setupDebug();
  setupOffline();
  if (state.done) return showEnd();
  if (state.station > 0) startGame((state.wantAr ?? state.mode === 'ar') ? 'ar' : 'fallback');   // Wunsch zählt, nicht der letzte Notfall-Modus
  else show('start');
}
boot();
