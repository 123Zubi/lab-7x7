// Ablaufsteuerung: Start → Anleitung → (AR | Fallback) → je Station: bereit? → Frage → Paar läuft zum Feld → Karte schwebt → Vollbild-Karte
// → nach Karte 4: letzte Frage (5) → Podest → Flitterwochen-Karte → Abschluss. (Neuer Ablauf, docs/ARCHITEKTUR.md 2026-10-21; keine Geldbeträge.)
import { state, save, reset, isDebug } from './state.js';
import { STATIONS, FINALE, INTRO, GUIDE, RESUME, END, READY, CARDS, CARD_UI, POSES, HOME } from './content.js';
import { sound, isMuted, toggleMute } from './sound.js';
import { createQuiz, ensureQuestions } from './quiz.js';
import { createFallbackStage, coupleSVG, stationBadge, hasImg, art } from './fallback.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest/i;
const stageEl = $('#stage');
// Anleitungsbild schon beim Laden der Seite holen und dekodieren: Sonst lädt der Browser es erst, wenn die Anleitung erscheint,
// und dann im Wettlauf mit A-Frame/MindAR/targets.mind (mehrere MB) – auf dem iPhone kam es erst, wenn die Kamera lief.
const preload = (src) => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); };
const guideImgReady = preload('assets/ui/anleitung.jpg');
const poseImgReady = preload('assets/ui/paar-hallo.png');   // Ladescreen beim Wiedereinstieg
const panel = $('#panel');
let stage = null;
let quiz = null;
let dotCb = null;
let session = 0;   // zählt hoch bei „Zurück zum Start“: ältere, noch wartende Abläufe (run, AR-Start) merken daran, dass sie verwaist sind
// Das Quiz spricht nur mit diesem Stellvertreter: die Bühne darf mitten im Spiel wechseln (AR ↔ Fallback).
const live = {
  highlightDot: (c) => stage && stage.highlightDot && stage.highlightDot(c),
  onDotTap: (cb) => { dotCb = cb; if (stage && stage.onDotTap) stage.onDotTap(cb); },
};

const show = (name) => { ['start', 'game', 'end'].forEach((s) => ($('#screen-' + s).hidden = s !== name)); fitScene(); };

/* Szenenbild (start.jpg/abschluss.jpg, 828x1242) so legen, dass die Gesichter zwischen Titelkasten und Buttons frei bleiben.
 *  Gesichter-Box in Bildanteilen; start: Bild füllt die Breite, oben Himmelfarbe; end: notfalls kleiner, unten bündig (Rand Elfenbein). */
const FACES = { start: { x: 0.545, y0: 0.24, y1: 0.34 }, end: { x: 0.54, y0: 0.15, y1: 0.29, shrink: true } };
function fitScene() {
  for (const k of ['start', 'end']) {
    const scr = $('#screen-' + k), f = FACES[k];
    if (scr.hidden || !document.body.classList.contains('scene-' + k)) continue;
    const r = scr.getBoundingClientRect(), W = r.width, H = r.height, pad = 10;
    const b1 = scr.querySelector('.start-top, .end-top').getBoundingClientRect().bottom - r.top + pad;
    const b2 = scr.querySelector('.start-bottom, .btn-again').getBoundingClientRect().top - r.top - pad;
    let s = Math.max(W / 828, H / 1242);
    if (f.shrink) s = Math.min(s, (H - b1) / (1242 * (1 - f.y0)));
    const w = 828 * s, h = 1242 * s, top = b1 - f.y0 * h, bot = b2 - f.y1 * h;
    const y = f.shrink ? H - h : Math.max(H - h, top <= bot ? top : (top + bot) / 2);
    const x = w > W ? Math.min(0, Math.max(W - w, W / 2 - f.x * w)) : (W - w) / 2;
    scr.style.backgroundSize = `${w}px ${h}px`;
    scr.style.backgroundPosition = `${x}px ${y}px`;
  }
}
addEventListener('resize', fitScene);
document.fonts.ready.then(fitScene);

/* ---------- Konfetti ---------- */
const cv = $('#confetti'), g = cv.getContext('2d');
let parts = [], raf = 0;
const COLORS = ['#f2b632', '#ef6f5c', '#2bb3a6', '#22346b', '#ffd166', '#ffffff', '#1b1f3b'];   // Comic-Palette
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
    g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.s / 2, p.s / 4, 0, 0, 7); g.fill(); g.restore();   // Blütenblätter
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
/** Sprechblase; `sit` wählt die Paar-Pose (POSES in content.js → --img-pose-* in style.css). */
const bubble = (html, sit) => `<div class="bubble-row">${art('pose-' + POSES[sit], coupleSVG(), 'avatars')}<div class="bubble">${html}</div></div>`;
const say = (html, label, sit) => card(bubble(html, sit), label);
const ICON_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
const ICON_CAM = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.4"/></svg>';

/* ---------- Schatz-Karten ---------- */
// Bilder werden automatisch verwendet, sobald sie existieren: genau eine Prüfung pro Datei und Seitenaufruf, Ergebnis gecacht.
// Fehlt eine Datei, kostet das einmalig eine 404-Zeile in der Konsole, danach nie wieder (bis zum nächsten Laden).
const probed = new Map();
const probe = (url) => {
  if (!probed.has(url)) probed.set(url, new Promise((res) => { const i = new Image(); i.onload = () => res(url); i.onerror = () => res(null); i.src = url; }));
  return probed.get(url);
};
const stop = (k) => (k < 4 ? STATIONS[k] : FINALE);
// Gefundenes Icon gilt überall (Badges lesen --img-<theme>, siehe style.css)
// absolute URL: eine relative URL in einer Inline-Variable löst der Browser sonst gegen css/ auf
const iconImg = (theme) => probe(`assets/ui/icon-${theme}.webp`).then((u) => { if (u) document.documentElement.style.setProperty('--img-' + theme, `url("${new URL(u, location.href).href}")`); return u; });
const cardImgs = (theme) => Promise.all([probe(`assets/cards/${theme}.jpg`), iconImg(theme)]);
const HEART = '<svg class="cf-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5c-5.4-3.7-8.5-6.5-8.5-10a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 3.5-3.1 6.3-8.5 10z"/></svg>';

const AUTO_OPEN_MS = 10000;
/** Schatz auf dem Feld (Truhe + schwebendes Icon), bis er angetippt wird (oder 10 s vergehen). Liefert (Fallback) die Position des Icons für den Flug. */
async function treasureScene(k) {
  const S = stop(k);
  if (!stage.showCard) return null;   // Bühne ohne Schatz-Szene (älteres ar.js): direkt zur Vollbild-Karte
  const icon = await iconImg(S.theme);   // Kartenbild nur vorladen, die Truhe wartet nicht darauf
  probe(`assets/cards/${S.theme}.jpg`);
  showPanel(`${bubble(`<p>${S.bubble}</p><p class="b-ask">${CARDS[k].lift}</p>`, k < 4 ? 'arrive' : 'finale')}<p class="tap-hint">${READY.tap}</p>`);
  // Wird das Icon 10 s nicht angetippt, öffnet sich die Karte von selbst (Reload in diesem Zustand: Uhr beginnt neu).
  let timer;
  const auto = new Promise((res) => (timer = setTimeout(() => res('auto'), AUTO_OPEN_MS)));
  const my = session;
  let from = await Promise.race([stage.showCard(...S.pos, { icon, theme: S.theme }), auto]);
  clearTimeout(timer);
  if (my !== session) return null;   // inzwischen zurück zum Start
  if (from === 'auto') {
    // Flug startet am Icon: Fallback hat es im DOM, AR (3D) nicht → kleiner Startpunkt in der Bildmitte
    const el = stageEl.querySelector('.fb-ticon-in');
    from = el ? el.getBoundingClientRect() : new DOMRect(innerWidth / 2 - 30, innerHeight * 0.4 - 30, 60, 60);
    stage.hideCard && stage.hideCard();
  }
  hidePanel();
  return from || null;
}

/** Vollbild-Karte. Schritt 'back': fliegt von `from` (Icon) zur Mitte und zeigt die Rückseite, bis sie angetippt wird.
 *  Schritt 'open': 3D-Flip auf die Vorderseite (Glöckchen, Goldfunken; Hauptschatz mit Konfetti), dann „Weiter“. Beide Schritte überstehen einen Reload. */
async function openCard(k, from) {
  const C = CARDS[k], S = stop(k), grand = k === 4, host = $('#card');
  const [[img], back] = await Promise.all([cardImgs(S.theme), probe('assets/cards/rueckseite.jpg')]);
  const sparks = Array.from({ length: grand ? 22 : 12 }, (_, j) => `<span class="cf-spark" style="--a:${(360 / (grand ? 22 : 12)) * j}deg;--d:${(j % 4) * 60}ms"></span>`).join('');
  const motes = Array.from({ length: 10 }, (_, j) => `<span class="cf-mote" style="--x:${8 + j * 9}%;--t:${3 + (j % 4)}s;--d:${(j * 0.37).toFixed(2)}s"></span>`).join('');
  host.innerHTML = `<div class="cf-motes" aria-hidden="true">${motes}</div>
  <div class="cf-stage${grand ? ' grand' : ''}" role="dialog" aria-modal="true" aria-labelledby="cf-title">
    <div class="cf-card"><div class="cf-flip">
      <div class="cf-face cf-back${back ? ' has-img' : ''}">${back ? `<img src="${back}" alt="">` : '<span class="cf-mono">M<i>&amp;</i>F</span>'}</div>
      <div class="cf-face cf-front${img ? ' has-img' : ''}">
        <div class="cf-art">${img ? `<img src="${img}" alt="">` : `<span class="cf-rays" aria-hidden="true"></span>${stationBadge(k, 'cf-badge')}`}</div>
        <div class="cf-text"><p class="cf-kicker">${C.kicker}</p><h2 class="cf-title" id="cf-title">${C.title}</h2><p class="cf-body">${C.text}</p></div>
      </div>
    </div><div class="cf-sparks" aria-hidden="true">${sparks}</div></div>
    <div class="cf-under">
      <p class="cf-tap">${READY.flip}</p>
      <p class="cf-ribbon">${HEART}<span>${C.lift}</span></p>
      <button class="btn btn-gold cf-btn">${CARD_UI.next}</button>
    </div>
  </div>`;
  const el = host.querySelector('.cf-flip'), cardEl = host.querySelector('.cf-card');
  host.className = 'overlay card-overlay';
  host.hidden = false;
  const tapWait = (target, ms) => new Promise((res) => { const t0 = performance.now(); target.onclick = () => { if (performance.now() - t0 < ms) return; target.onclick = null; res(); }; });

  if (step() === 'back') {
    cardEl.setAttribute('role', 'button'); cardEl.setAttribute('aria-label', READY.flip); cardEl.tabIndex = 0;
    if (from) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--fx', from.left + from.width / 2 - (r.left + r.width / 2) + 'px');
      el.style.setProperty('--fy', from.top + from.height / 2 - (r.top + r.height / 2) + 'px');
      el.style.setProperty('--fs', Math.max(0.08, from.width / r.width));
      host.classList.add('fly');
    } else host.classList.add('appear');
    sound.click();
    await tapWait(host.querySelector('.cf-stage'), 650);   // zweiter Tipp: irgendwo auf Karte oder Hinweis
    setStep('open');
    cardEl.removeAttribute('role'); cardEl.removeAttribute('aria-label'); cardEl.tabIndex = -1;
    host.classList.add('flipped');
    setTimeout(sound.bell, 80);
    if (grand) { sound.fanfare(); setTimeout(() => confetti(160), 300); setTimeout(() => confetti(100), 1300); }
  } else host.classList.add('flipped', 'instant');   // Reload mit offener Karte

  await tapWait(host.querySelector('.cf-btn'), 700);
  sound.click(); host.hidden = true; host.className = 'overlay card-overlay'; host.innerHTML = '';
}

/* ---------- Fortschrittsanzeige ---------- */
function updateHud() {
  $('#pips').innerHTML = [0, 1, 2, 3, 4].map((i) => {
    const doneP = i < 4 ? state.solved.includes(i) && state.station > i + 1 : state.done;
    const curP = i < 4 ? state.station === i + 1 : state.station === 5;
    return `<li class="${doneP ? 'done' : ''} ${curP ? 'cur' : ''} ${i === 4 ? 'star' : ''}"></li>`;
  }).join('');
  $('#btn-sound').innerHTML = isMuted() ? ICON_MUTE : ICON_SOUND;
}

/* ---------- Spielablauf ---------- */
// Fortschritt: station 1..4 = aktuelle Frage/Station, 5 = letzte Frage + Finale (Podest); step = 'ready' | 'quiz' | 'card' (Truhe/Icon) | 'back' (Karte zeigt Rückseite) | 'open' (Vorderseite).
const step = () => state.step || 'ready';
const setStep = (st) => { state.step = st; save(); };
/** Wo das Paar gerade steht (Index für walkTo, -1 = Start). Bei 'card' steht es noch an der vorigen Station: der Lauf (auch zum Podest) folgt. */
const coupleAt = () => { const k = Math.min(state.station, 5) - 1; return ['back', 'open'].includes(step()) ? k : k - 1; };

async function run() {
  const my = session, gone = () => my !== session;   // nach „Zurück zum Start“ endet dieser Ablauf still
  if (state.station === 0) { state.station = 1; setStep('ready'); }
  updateHud();
  if (coupleAt() >= 0) await stage.walkTo(coupleAt(), { instant: true });
  while (!state.done) {
    if (gone()) return;
    const k = state.station - 1, fin = k === 4;
    let from = null;
    updateHud();
    if (step() === 'ready') {
      const first = k === 0;
      await say(first ? `<p>${INTRO}</p><p class="b-ask">${READY.first}</p>` : `<p class="b-ask">${fin ? READY.last : READY.next}</p>`, first ? READY.go : READY.yes, first ? 'intro' : 'ready');
      if (gone()) return;
      setStep('quiz');
    }
    if (step() === 'quiz' && state.solved.includes(k)) setStep('card');   // Reload kurz nach der richtigen Antwort: nicht nochmal fragen
    if (step() === 'quiz') {
      await quiz.ask(k);
      if (gone()) return;
      stage.highlightDot && stage.highlightDot(null);
      setStep('card');
      sound.fanfare(); stage.cheer(); confetti(140);
      await sleep(1300);
      if (gone()) return;
    }
    if (step() !== 'open' && step() !== 'back') {
      if (step() !== 'card') setStep('card');
      hidePanel();
      // Wechselt die Bühne mitten im Lauf oder während der Truhe (Kamera fällt aus / kommt zurück), auf der neuen Bühne wiederholen.
      for (let s = null; s !== stage;) { s = stage; await s.walkTo(k); }
      if (gone()) return;
      stage.cheer();
      for (let s = null; s !== stage;) { s = stage; from = await treasureScene(k); }
      if (gone()) return;
      setStep('back');
    }
    hidePanel();
    stage.hideCard && stage.hideCard();
    await openCard(k, from);
    if (gone()) return;
    if (fin) { state.done = true; save(); break; }
    Object.assign(state, { station: state.station + 1, step: 'ready', wrongCount: 0, usingBackup: false, extra: null, wrong: [], gone: [] });
    save();
  }
  showEnd();
}

/* ---------- Zurück zum Start (Tipp auf den Titel im HUD) ---------- */
// Spielstand bleibt; die Bühne wird zerstört (Kamera aus). Ein erneuter Start macht dort weiter, wo das Paar stand.
const homeAsk = document.createElement('div');
homeAsk.className = 'home-ask';
homeAsk.setAttribute('role', 'dialog'); homeAsk.setAttribute('aria-labelledby', 'home-ask-t');
homeAsk.hidden = true;
homeAsk.innerHTML = `<p id="home-ask-t">${HOME.ask}</p><div class="home-ask-btns"><button class="btn btn-gold" data-a="yes">${HOME.yes}</button><button class="btn btn-ghost" data-a="no">${HOME.no}</button></div>`;
$('#screen-game').append(homeAsk);
const closeHomeAsk = () => { homeAsk.hidden = true; $('#hud-home').setAttribute('aria-expanded', 'false'); };
$('#hud-home').onclick = () => {
  sound.click();
  const open = homeAsk.hidden;
  homeAsk.hidden = !open; $('#hud-home').setAttribute('aria-expanded', String(open));
  if (open) homeAsk.querySelector('[data-a="no"]').focus();
};
homeAsk.onclick = (e) => {
  const a = e.target.closest('button') && e.target.closest('button').dataset.a;
  if (!a) return;
  sound.click(); closeHomeAsk();
  if (a === 'yes') goHome();
};
function goHome() {
  session++;
  if (quiz && quiz.stop) quiz.stop();
  quiz = null;
  hidePanel();
  $('#card').hidden = true; $('#card').className = 'overlay card-overlay'; $('#card').innerHTML = '';   // Schritt 'back'/'open' bleibt im Spielstand: die Karte kommt beim Weiterspielen wieder
  guide.close();
  retryBtn.hidden = true;
  if (stage) { stage.hideCard && stage.hideCard(); stage.destroy && stage.destroy(); stage.host && stage.host.remove(); }
  stage = null;
  stageEl.innerHTML = '';
  document.body.classList.remove('mode-ar');
  state.home = true; save();   // Reload landet ebenfalls im Startmenü
  show('start');
  updateTip();
}

/** „Nochmals spielen“: Fortschritt, Fragen, Joker, Karten zurück, ohne Reload zurück zum Startmenü (Mit/Ohne Kamera neu wählbar).
 *  Die Bühne wurde in showEnd zerstört (Kamera aus); hier verschwindet auch ihr Container. Die nächsten Fragen zieht startGame neu. */
function playAgain() {
  sound.click();
  endTimers.forEach(clearTimeout); endTimers = [];   // Konfetti-Nachschub des Abschlusses stoppen
  reset();
  $('#card').hidden = true; $('#card').innerHTML = '';
  parts = [];
  if (stage && stage.host) stage.host.remove();
  stage = null;
  document.body.classList.remove('mode-ar');
  show('start');
  updateTip();
}

let endTimers = [];
function showEnd() {
  hidePanel(); closeHomeAsk();
  if (stage && stage.destroy) stage.destroy();
  retryBtn.hidden = true;
  $('#end-couple').innerHTML = coupleSVG();
  const list = [...STATIONS, FINALE];
  const paint = () => ($('#end-list').innerHTML = list.map((s, k) => `<li>${stationBadge(k)}<span class="p-name">${s.name}</span></li>`).join(''));
  paint(); Promise.all(list.map((s) => iconImg(s.theme))).then(paint);
  show('end');
  sound.fanfare();
  confetti(180);
  endTimers = [1, 2, 3, 4, 5].map((k) => setTimeout(() => confetti(90), k * 1800));
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

/* ---------- Spielbrett-Erkennung (targets.mind, 6 MB) ---------- */
// Genau ein Download pro Seitenaufruf: das Vorladen auf dem Startscreen und der Kamerastart teilen ihn sich.
// Ergebnis ist eine Blob-URL, die ar.js an MindAR gibt (kein zweiter Abruf, auch nicht beim Kamera-Neustart).
// Scheitert es, kommt 'targets.mind' zurück: ar.js lädt dann selbst und meldet ggf. TargetError.
let targetsP = null, targetsDone = false, targetsPct = null;
function loadTargets() {
  if (!targetsP) targetsP = (async () => {
    const r = await fetch('targets.mind');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!r.body) return URL.createObjectURL(await r.blob());
    const total = r.headers.get('content-encoding') ? 0 : +r.headers.get('content-length') || 0;
    const rd = r.body.getReader(), parts = [];
    for (let n = 0; ;) {
      const { done, value } = await rd.read();
      if (done) break;
      parts.push(value); n += value.length;
      if (total && targetsPct) targetsPct(Math.min(1, n / total));
    }
    targetsDone = true;
    return URL.createObjectURL(new Blob(parts));
  })().catch((e) => { console.warn('targets.mind nicht vorgeladen:', e); targetsP = null; return 'targets.mind'; });
  return targetsP;
}

async function tryAr(view) {
  // 45 s Zeitbudget – die Zeit im Kamera-Dialog zählt nicht: ar.js meldet Phasen, bei 'permission' steht die Uhr,
  // nach erteilter Erlaubnis ('starting') beginnt sie neu.
  const AR_TIMEOUT = 45000, SHOW_CANCEL = 8000;
  const PHASE = { loading: GUIDE.status.loading, permission: GUIDE.status.permission, starting: GUIDE.status.starting };
  const STEPS = [[12000, 'Das dauert länger als sonst …'], [30000, 'Fast fertig …']];
  const text = (t) => view.text(t);
  let cancel, timeUp, timers = [], lost = false, cur = 'loading', pct = -1;
  const cancelled = new Promise((_, rej) => (cancel = () => rej(named('Cancelled', 'abgebrochen'))));
  const timeout = new Promise((_, rej) => (timeUp = () => rej(named('Timeout', 'Zeitüberschreitung'))));
  const disarm = () => { timers.forEach(clearTimeout); timers = []; };
  const arm = () => { disarm(); timers = [setTimeout(timeUp, AR_TIMEOUT), ...STEPS.map(([ms, t]) => setTimeout(() => text(t), ms))]; };
  const onPhase = (p) => {
    if (lost || !PHASE[p]) return;
    cur = p;
    text(PHASE[p]); view.phase(p);
    if (p === 'permission') disarm(); else arm();
  };
  text(PHASE.loading); view.phase('loading');
  // Download-Fortschritt in Prozent. Solange Daten fliessen, beginnt die Uhr neu: bei langsamem Netz zählt nur ein Stillstand.
  if (!targetsDone) targetsPct = (f) => {
    const p = Math.round(f * 100);
    if (lost || cur !== 'loading' || p === pct) return;
    pct = p;
    text(p < 100 ? GUIDE.status.percent.replace('{p}', p) : PHASE.loading);
    view.progress(f);
    arm();
  };
  view.open();
  view.btn.onclick = () => { sound.click(); cancel(); };
  const slow = setTimeout(() => view.slow(), SHOW_CANCEL);
  arm();
  // Eigener Host-Container: eine zu spät fertige AR-Bühne räumt nur sich selbst weg, nicht den Fallback.
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  stageEl.append(host);
  const ar = import('./ar.js').then((m) => m.createArStage(host, { onPhase, onFatal: arFatal, targets: loadTargets() }));
  ar.then((s) => { if (lost) s.destroy && s.destroy(); }, () => {}); // kam sie doch noch: Kamera aus, Szene weg
  try {
    const s = await Promise.race([ar, cancelled, timeout]);
    s.host = host;
    return s;
  } catch (e) {
    lost = true;
    console.warn('AR nicht verfügbar:', e);
    host.remove();
    view.fail(e);
    return null;
  } finally {
    clearTimeout(slow); disarm();
    targetsPct = null;
    view.close();
  }
}

/* ---------- Anleitungs-Screen / Ladescreen ---------- */
// Erststart: Anleitung. Wiedereinstieg mit Kamera (Spielstand, Reload, „Kamera nochmal versuchen“): kurzer Ladescreen
// (Klasse .resume) mit Paar, Station und wechselnden Tipps. Beide zeigen denselben Fortschritt, die Kamera startet darunter.
const guide = (() => {
  const root = $('#guide'), st = $('#guide-status'), go = $('#btn-go'), cancelBtn = $('#guide-cancel'), tip = $('#g-tip'), pose = $('#g-pose');
  const STEP = { loading: 1, permission: 2, starting: 3, ready: 4 };
  let resume = false, cancelled = false, tipT = 0;
  const setStatus = (t, kind = 'busy', step = 0) => {
    st.querySelector('.g-text').textContent = t;
    st.dataset.kind = kind;
    st.style.setProperty('--step', step);
  };
  const view = {
    btn: cancelBtn,
    text: (t) => setStatus(t, 'busy', +st.style.getPropertyValue('--step') || 1),
    phase: (p) => st.style.setProperty('--step', STEP[p] || 1),
    progress: (f) => st.style.setProperty('--step', 0.15 + 0.85 * f),   // Download füllt den ersten Abschnitt
    open() { cancelBtn.hidden = false; },
    slow() {},
    close() { cancelBtn.hidden = true; },
    fail(e) { cancelled = e.name === 'Cancelled'; setStatus(cancelled ? GUIDE.status.cancelled : arMsg(e), 'off'); },
  };
  const close = () => { clearInterval(tipT); root.hidden = true; };
  const nextTip = (i) => { tip.textContent = RESUME.tips[i % RESUME.tips.length]; tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in'); };
  return {
    view,
    close,
    /** again = Wiedereinstieg (Ladescreen statt Anleitung). */
    open(withCam, again = false) {
      resume = again; cancelled = false;
      const T = again ? RESUME : GUIDE;
      root.classList.toggle('resume', again);
      $('#g-kicker').textContent = again ? RESUME.kicker.replace('{n}', Math.min(5, Math.max(1, state.station))) : GUIDE.kicker;
      $('#guide-title').textContent = T.title;
      $('#g-intro').textContent = T.intro;
      $('#g-steps-title').textContent = GUIDE.stepsTitle;
      $('#g-steps').innerHTML = GUIDE.steps.map((t) => `<li>${t}</li>`).join('');
      $('#g-tips-title').textContent = T.tipsTitle;
      $('#g-tips').innerHTML = GUIDE.tips.filter((t) => withCam || !t.ar).map((t) => `<li>${t.text}</li>`).join('');
      $('#g-warn').textContent = GUIDE.warn;
      pose.className = 'g-pose art art-pose-hallo';
      clearInterval(tipT);
      if (again) { let i = 0; nextTip(i); tipT = setInterval(() => nextTip(++i), 5000); }
      cancelBtn.textContent = T.cancel;
      go.textContent = T.go;
      go.disabled = true;   // ready() gibt frei, sobald die Bühne steht – auch ohne Kamera (sonst verpufft der erste Tipp)
      if (withCam) setStatus(GUIDE.status.loading, 'busy', 1); else setStatus(GUIDE.status.plain, 'plain');
      root.hidden = false;
      root.querySelector('.guide-scroll').scrollTop = 0;
    },
    /** Bühne steht (AR bereit oder Fallback): Button frei, wartet auf „Los geht’s“ bzw. „Weiter spielen“. */
    ready(isAr) {
      if (isAr) { setStatus(GUIDE.status.ready, 'ready', 4); pose.className = 'g-pose art art-pose-jubel'; }
      go.disabled = false;
      if (resume && cancelled) { close(); return Promise.resolve(); }   // „Lieber ohne Kamera“ beim Wiedereinstieg: direkt weiter
      return new Promise((res) => (go.onclick = () => { sound.click(); go.onclick = null; fullscreen(); close(); res(); }));
    },
  };
})();

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
    if (coupleAt() >= 0) next.walkTo(coupleAt(), { instant: true });
    if (old.destroy) old.destroy();
    if (old.host) old.host.remove();
  }
  state.mode = next.isAr ? 'ar' : 'fallback'; save();
  updateRetry();
}

// AR gewünscht, aber gerade im Fallback (Fehler, Abbruch, Kamera ausgefallen): Kamera nochmal versuchen, Spielstand bleibt.
const retryBtn = document.createElement('button');
retryBtn.className = 'chip';
retryBtn.innerHTML = ICON_CAM + 'Kamera nochmal versuchen';
retryBtn.classList.add('chip-btn');
retryBtn.hidden = true;
$('#screen-game').append(retryBtn);
const updateRetry = () => (retryBtn.hidden = !(state.wantAr && stage && !stage.isAr && !state.done));
retryBtn.onclick = async () => {
  sound.click();
  retryBtn.hidden = true;
  document.body.classList.add('mode-ar');   // vorher: MindAR misst die Bühne beim Start (Vollbild im AR-Layout)
  const my = session;
  guide.open(true, true);
  const ar = await tryAr(guide.view);
  if (my !== session) { if (ar) { ar.destroy && ar.destroy(); ar.host && ar.host.remove(); } return; }
  const ok = ar && !state.done;
  if (ok) useStage(ar);
  else {
    if (ar) ar.destroy();
    document.body.classList.remove('mode-ar');
    updateRetry();
  }
  if (state.done) guide.close(); else await guide.ready(!!ok);
};

async function arFatal() {
  if (!stage || !stage.isAr) return;
  toast('Die Kamera ist ausgefallen – wir spielen ohne Kamera weiter.');
  if (!$('#guide').hidden) guide.view.fail(named('ArError'));   // Anleitung noch offen: „Kamera bereit“ stimmt nicht mehr
  const my = session;
  const fb = await fallbackStage();
  if (state.done || my !== session) { fb.destroy(); fb.host.remove(); return; }
  useStage(fb);
}

/** fresh = noch keine Station begonnen → Anleitung. Sonst mit Kamera der Ladescreen (Wiedereinstieg), ohne Kamera direkt weiter. */
async function startGame(mode, fresh = false) {
  const my = session, guided = fresh || mode === 'ar';
  show('game');
  state.wantAr = mode === 'ar'; state.home = false; save();
  document.body.classList.toggle('mode-ar', mode === 'ar');
  if (guided) guide.open(mode === 'ar', !fresh);   // Kamera startet darunter, Anleitung bzw. Ladescreen deckt die Bühne ab
  if (mode === 'ar') {   // AR-Downloads erst, wenn das Bild oben steht (höchstens 2 s warten)
    await Promise.race([fresh ? guideImgReady : poseImgReady, sleep(2000)]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  let s = mode === 'ar' ? await tryAr(guide.view) : null;
  const plain = !s;
  if (plain) s = await fallbackStage();
  if (my !== session) { s.destroy && s.destroy(); s.host && s.host.remove(); return; }
  useStage(s);
  quiz = createQuiz({ root: panel, stage: live, sound });
  await ensureQuestions();   // 5 Fragen ziehen (oder die gespeicherten dieses Spiels behalten)
  if (guided) await guide.ready(!plain);
  if (my !== session) return;
  run().catch((e) => { console.error(e); toast('Etwas ist schiefgelaufen – wir laden neu.'); setTimeout(() => location.reload(), 2500); });
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
      Object.assign(state, { mode, station: Math.min(k, 5), step: 'ready', solved: Array.from({ length: Math.max(0, Math.min(k, 5) - 1) }, (_, j) => j), done: k === 6 });
      save();
    }
    location.reload();
  };
}

/* ---------- Vollbild ---------- */
// iPhone-Safari kennt keine Fullscreen-API für Seiten: dort hilft nur der Web-App-Modus (Home-Bildschirm, manifest + apple-mobile-web-app-capable).
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const TIP_KEY = 'hochzeit-labyrinth-tipp-vollbild';
/** Android/Chrome: beim Spielstart (Klick = Nutzergeste) Vollbild anfordern. Nur auf Touch-Geräten, nicht im Web-App-Modus. */
function fullscreen() {
  if (IOS || standalone() || document.fullscreenElement || !matchMedia('(pointer: coarse)').matches) return;
  try { const p = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); if (p) p.catch(() => {}); } catch {}
}
/** Tipp „Zum Home-Bildschirm“ auf dem Startmenü: nur iOS im Browser (nicht in WhatsApp & Co.), wegklickbar, gemerkt. */
function updateTip() {
  let off = false;
  try { off = localStorage.getItem(TIP_KEY) === '1'; } catch {}
  $('#a2hs').hidden = off || !IOS || standalone() || IN_APP.test(navigator.userAgent);
}
$('#a2hs-close').onclick = () => {
  sound.click();
  try { localStorage.setItem(TIP_KEY, '1'); } catch {}
  $('#a2hs').hidden = true;
};

/* ---------- Offline-Hilfe (sw.js) ---------- */
// Dieselben URLs wie in ar.js (AFRAME_SRC/MINDAR_SRC) – bei Versionswechsel dort hier mitziehen.
const CDN_URLS = ['https://aframe.io/releases/1.5.0/aframe.min.js', 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js'];
async function setupOffline() {
  const sw = 'serviceWorker' in navigator && !!window.caches;
  if (sw && new URLSearchParams(location.search).get('nocache') === '1') try { // Testhilfe: SW + Caches entfernen, SW diesmal nicht neu registrieren
    // Nur die eigene Registrierung (gleicher Scope) und eigene Caches ('hl-…'): auf demselben Origin liegt z. B. /Lab-7x7_Kitschig/.
    const scope = new URL('./', location.href).href;
    await Promise.all((await navigator.serviceWorker.getRegistrations()).filter((r) => r.scope === scope).map((r) => r.unregister()));
    await Promise.all((await caches.keys()).filter((k) => k.startsWith('hl-app-') || k.startsWith('hl-cdn-')).map((k) => caches.delete(k)));
    history.replaceState(null, '', location.pathname);
    return console.info('Offline-Cache geleert');
  } catch (e) { return console.warn('Offline-Cache nicht geleert:', e); }
  // Erst die UI-Bilder, dann die Spielbrett-Erkennung vorladen (6 MB): „Mit Kamera“ findet sie meist schon fertig vor.
  // Danach erst der SW: seine Installation prüft targets.mind dann nur noch nach (304) statt sie ein zweites Mal zu laden.
  await guideImgReady;
  if (document.readyState !== 'complete') await new Promise((r) => addEventListener('load', r, { once: true }));
  await loadTargets();
  if (!sw) return;
  try {
    await navigator.serviceWorker.register('sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    // CDN-Skripte im Hintergrund holen (no-cors wie das <script>-Tag; Antwort ist opak). Direkt in den Cache, unabhängig davon, ob der SW die Seite schon steuert.
    const cdn = await caches.open('hl-cdn-v1');
    await Promise.all(CDN_URLS.map(async (u) => { if (!(await cdn.match(u))) await cdn.put(u, await fetch(u, { mode: 'no-cors' })); }));
    const appKey = (await caches.keys()).find((k) => k.startsWith('hl-app-'));   // nur eigene Caches prüfen (gleicher Origin wie andere Apps)
    const app = appKey && await caches.open(appKey);
    const ok = app && await Promise.all([...CDN_URLS.map((u) => cdn.match(u)), ...['targets.mind', 'index.html', 'assets/target.jpg'].map((u) => app.match(new URL(u, location.href).href, { ignoreSearch: true }))]);
    const offlineEl = document.querySelector('#offline-ok');   // Anzeige entfernt; Prüfung bleibt, Element fehlt bewusst
    if (offlineEl && ok && ok.every(Boolean)) offlineEl.hidden = false;
  } catch (e) { console.warn('Offline-Hilfe nicht verfügbar:', e); }
}

function boot() {
  $('#start-couple').innerHTML = coupleSVG();
  if (IN_APP.test(navigator.userAgent)) $('#inapp-note').hidden = false;
  // Anleitung nur, solange noch keine Station begonnen ist (sonst geht es direkt beim gespeicherten Stand weiter)
  const fresh = () => state.station === 0 || (state.station === 1 && step() === 'ready' && !state.solved.length);
  $('#btn-ar').onclick = () => { sound.click(); startGame('ar', fresh()); };
  $('#btn-plain').onclick = () => { sound.click(); startGame('fallback', fresh()); };
  $('#btn-setup').onclick = async () => {   // Setup-Guide fürs Spielbrett (Plättchen abgefallen)
    sound.click();
    const { openSetup } = await import('./setup.js');
    openSetup($('#setup'), () => $('#btn-setup').focus());
  };
  document.querySelectorAll('[data-img]').forEach((el) => el.classList.toggle('has-img', hasImg(el.dataset.img)));
  document.body.classList.toggle('has-paper', hasImg('paper'));   // Papier bringt eigene Eck-Ornamente mit → CSS-Rahmen aus
  ['start', 'guide', 'end'].forEach((k) => document.body.classList.toggle('scene-' + k, hasImg('bg-' + k)));   // Szenen-Layout nur mit Bild
  $('#end-kicker').textContent = END.kicker; $('#end-title').textContent = END.title;
  $('#btn-again-text').textContent = END.again;
  $('#btn-again').onclick = playAgain;
  $('#end-list-title').textContent = END.list; $('#end-wish').textContent = END.wish; $('#end-note').textContent = END.note;
  $('#btn-sound').onclick = () => { toggleMute(); updateHud(); };
  if (isDebug()) setupDebug();
  setupOffline();
  if (state.done) return showEnd();
  if (state.station > 0 && !state.home) startGame((state.wantAr ?? state.mode === 'ar') ? 'ar' : 'fallback');   // Wunsch zählt, nicht der letzte Notfall-Modus
  else { show('start'); updateTip(); }
}
boot();
