// Quiz im Millionär-Stil (eigenes Design). Regeln: Plan §8.
// Falsch → rot + deaktiviert; nach 2 Falschen → Backup-Frage (dort Falsche nur ausgegraut, ohne Rot).
// Joker 50:50 einmal pro Spiel (Zustand in state.jokers). Fragen: je Stufe 1..5 eine aus dem Pool (questions.js), siehe ensureQuestions.
import { DOTS, LETTERS, POSES, MINI_POOL, QUESTION_COUNT } from './content.js';
import { art, coupleSVG } from './fallback.js';
import { state, save, PLAYED_KEY } from './state.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const HINT = 'Antwort antippen – oder den Farbpunkt auf dem Brett.';
const WRONG = 'Leider nicht, versucht es nochmal!';
const SOFT = 'Nicht ganz – nehmt eine andere Antwort.'; // Backup-Frage: sanft, ohne Rot

const readPlayed = () => { try { const a = JSON.parse(localStorage.getItem(PLAYED_KEY)); return Array.isArray(a) ? a : []; } catch { return []; } };
const writePlayed = (a) => { try { localStorage.setItem(PLAYED_KEY, JSON.stringify(a)); } catch {} };
/** Antworten mischen (A–D-Farben bleiben, nur die Texte wandern). */
const mix = (q, a, correct) => { const p = shuffle([0, 1, 2, 3]); return { text: q, options: p.map((i) => a[i]), correct: p.indexOf(correct) }; };

/** Je Stufe 1..5 eine noch nicht gespielte Frage ziehen; sind alle einer Stufe gespielt, beginnt diese Stufe von vorn.
 *  Gezogene Fragen gelten sofort als gespielt (Key überlebt ?reset=1 und „Nochmals spielen“). Ergebnis steht in state.qs,
 *  ein Reload behält also Fragen und Antwortreihenfolge. Fehlt questions.js, dient MINI_POOL (content.js) als Pool. */
export async function ensureQuestions() {
  if (Array.isArray(state.qs) && state.qs.length === QUESTION_COUNT) return;
  const mod = await import('./questions.js').catch(() => null);
  const pool = mod && Array.isArray(mod.POOL) && mod.POOL.length ? mod.POOL : MINI_POOL;
  let played = readPlayed();
  state.qs = Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const lv = i + 1;
    let cand = pool.filter((p) => p.level === lv);
    if (!cand.length) cand = MINI_POOL.filter((p) => p.level === lv);   // Stufe fehlt im Pool: Ersatzfrage
    let fresh = cand.filter((p) => !played.includes(p.id));
    if (!fresh.length) { played = played.filter((id) => !cand.some((p) => p.id === id)); fresh = cand; }   // Stufe durchgespielt: neu beginnen
    const p = fresh[Math.floor(Math.random() * fresh.length)];
    played.push(p.id);
    return { id: p.id, question: mix(p.q, p.a, p.correct), backup: mix(p.backup.q, p.backup.a, p.backup.correct) };
  });
  writePlayed(played);
  save();
}

export function createQuiz({ root, stage, sound }) {
  let idx = 0, active = false, busy = false, done = null, shownAt = 0;
  const early = () => performance.now() - shownAt < 400; // Klicksperre nach render: Doppeltipp auf „Zur Frage“ darf keinen Joker treffen
  const cur = () => (state.usingBackup ? state.qs[idx].backup : state.qs[idx].question);
  const btns = () => [...root.querySelectorAll('.ans')];
  const wrongMsg = () => (state.usingBackup ? [SOFT, 'soft'] : [WRONG, 'bad']);
  const SIT = { '': 'question', ok: 'right', bad: 'wrong', soft: 'wrong', pity: 'pity' };   // Meldung → Paar-Pose (POSES)
  const say = (t, cls = '') => {
    const m = root.querySelector('.q-msg');
    if (!m) return;
    m.className = 'q-msg ' + cls;
    m.innerHTML = `${art('pose-' + POSES[SIT[cls] || 'question'], coupleSVG(), 'q-ava')}<span class="q-txt"></span>`;
    m.lastChild.textContent = t;
  };

  function render() {
    root.hidden = false; // zentral: auch nach Reload mitten in der Frage (Sprechblase übersprungen) muss das Panel sichtbar sein
    shownAt = performance.now();
    const q = cur();
    root.innerHTML = `<div class="quiz">
      <div class="q-head"><span class="q-tag">Frage ${idx + 1} von ${QUESTION_COUNT}</span>${state.usingBackup ? '<span class="q-tag backup">Leichtere Frage</span>' : ''}<span class="jokers"><button class="joker" data-j="fifty">50:50</button></span></div>
      <div class="q-text"><span>${q.text}</span></div>
      <div class="answers">${q.options.map((o, i) => `<button class="ans" data-i="${i}" style="--lc:${DOTS[i].hex}" aria-label="Antwort ${LETTERS[i]}: ${o}"><span class="ans-in"><span class="letter l${i}">${LETTERS[i]}</span><span class="txt">${o}</span></span></button>`).join('')}</div>
      <p class="q-msg" aria-live="polite"></p>
    </div>`;
    btns().forEach((b, i) => (b.onclick = () => pick(i)));
    root.querySelector('[data-j=fifty]').onclick = fifty;
    paint();
    say(...(state.wrong.length ? wrongMsg() : [HINT]));
  }

  function paint() {
    btns().forEach((b, i) => {
      const w = state.wrong.includes(i), g = state.gone.includes(i);
      b.classList.toggle('wrong', w && !state.usingBackup);
      b.classList.toggle('off', w && state.usingBackup);
      b.classList.toggle('gone', g);
      b.disabled = w || g;
      b.setAttribute('aria-hidden', g ? 'true' : 'false');
    });
    root.querySelectorAll('.joker').forEach((j) => { j.disabled = state.jokers[j.dataset.j]; });
  }

  async function pick(i) {
    if (i < 0 || !active || busy || early() || state.wrong.includes(i) || state.gone.includes(i)) return;
    busy = true;
    const q = cur(), b = btns()[i];
    sound.click();
    stage.highlightDot && stage.highlightDot(DOTS[i].color);
    b.classList.add('locked');
    sound.tension();
    say('Ist das eure endgültige Antwort?');
    await sleep(1100);
    b.classList.remove('locked');
    if (i === q.correct) {
      b.classList.add('right');
      sound.right();
      say('Richtig!', 'ok');
      if (!state.solved.includes(idx)) state.solved.push(idx);
      state.wrong = []; state.gone = [];
      save();
      await sleep(1300);
      active = false; busy = false;
      done && done();
      return;
    }
    state.wrong.push(i);
    sound.wrong();
    stage.highlightDot && stage.highlightDot(null);
    if (!state.usingBackup && ++state.wrongCount >= 2) {
      state.usingBackup = true; state.wrong = []; state.gone = []; // vor dem Warten speichern: Reload zeigt direkt die Backup-Frage
      save();
      b.classList.add('wrong'); b.disabled = true; // Anzeige bleibt bis zur Backup-Frage rot
      say('Das Brautpaar hat Mitleid – hier kommt eine leichtere Frage!', 'pity');
      await sleep(2300);
      render(); busy = false;
      return;
    }
    save(); paint();
    say(...wrongMsg());
    busy = false;
  }

  function fifty() {
    if (busy || early() || state.jokers.fifty || !active) return;
    const q = cur();
    const cand = [0, 1, 2, 3].filter((i) => i !== q.correct && !state.wrong.includes(i) && !state.gone.includes(i));
    if (cand.length < 2) { say('Jetzt würde der Joker nichts mehr bringen.'); return; }
    shuffle(cand).slice(0, cand.length - 1).forEach((i) => state.gone.push(i));
    state.jokers.fifty = true; save(); paint(); sound.click();
    say('50:50 – falsche Antworten sind raus!');
  }

  if (stage.onDotTap) stage.onDotTap((c) => pick(typeof c === 'number' ? c : DOTS.findIndex((d) => d.color === c)));

  return { ask(i) { idx = i; active = true; busy = false; render(); return new Promise((r) => (done = r)); } };
}
