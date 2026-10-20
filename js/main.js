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
function showPanel(html) {
  panel.innerHTML = html;
  panel.hidden = false;
  panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
}
const hidePanel = () => { panel.hidden = true; panel.innerHTML = ''; };
const card = (html, label) => new Promise((res) => {
  showPanel(`${html}<button class="btn btn-gold panel-btn">${label}</button>`);
  panel.querySelector('.panel-btn').onclick = () => { sound.click(); res(); };
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
  toast.t = setTimeout(() => (t.hidden = true), 6000);
}

async function tryAr() {
  let cancelled = false;
  $('#loading').hidden = false;
  $('#btn-cancel-ar').onclick = () => { cancelled = true; $('#loading').hidden = true; };
  try {
    const mod = await import('./ar.js');
    const s = await mod.createArStage(stageEl);
    if (cancelled) { s.destroy && s.destroy(); throw new Error('abgebrochen'); }
    return s;
  } catch (e) {
    console.warn('AR nicht verfügbar:', e);
    stageEl.innerHTML = '';
    if (!cancelled) toast(e && e.name === 'NotAllowedError' ? 'Kamera nicht erlaubt – wir spielen ohne Kamera weiter.' : 'Die Kamera ist gerade nicht verfügbar – wir spielen ohne Kamera weiter.');
    return null;
  } finally {
    $('#loading').hidden = true;
  }
}

async function startGame(mode) {
  show('game');
  document.body.classList.toggle('mode-ar', mode === 'ar');
  stage = mode === 'ar' ? await tryAr() : null;
  document.body.classList.toggle('mode-ar', !!stage);
  if (!stage) {
    stage = await createFallbackStage(stageEl);
    $('#hint').hidden = false;
    setTimeout(() => ($('#hint').hidden = true), 9000);
  }
  state.mode = stage.isAr === false ? 'fallback' : 'ar'; save();
  quiz = createQuiz({ root: panel, modal: $('#modal'), stage, sound });
  run(state.station > 0);
}

function setupDebug() {
  const d = $('#debug');
  d.hidden = false;
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

function boot() {
  $('#start-couple').innerHTML = coupleSVG();
  if (IN_APP.test(navigator.userAgent)) $('#inapp-note').hidden = false;
  $('#btn-ar').onclick = () => { sound.click(); startGame('ar'); };
  $('#btn-plain').onclick = () => { sound.click(); startGame('fallback'); };
  $('#btn-sound').onclick = () => { toggleMute(); updateHud(); };
  if (isDebug()) setupDebug();
  if (state.done) return showEnd();
  if (state.station > 0) startGame(state.mode || 'fallback');
  else show('start');
}
boot();
