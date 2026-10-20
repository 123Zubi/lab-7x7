// Quiz im Millionär-Stil (eigenes Design). Regeln: Plan §8.
// Falsch → rot + deaktiviert; nach 2 Falschen → Backup-Frage (dort Falsche nur deaktivieren).
// Joker 50:50 und Publikum je einmal pro Spiel (Zustand in state.jokers).
import { STATIONS, DOTS, LETTERS } from './content.js';
import { state, save } from './state.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const HINT = 'Antwort antippen – oder den Farbpunkt auf dem Brett.';
const WRONG = 'Leider nicht, versucht es nochmal!';

export function createQuiz({ root, modal, stage, sound }) {
  let idx = 0, active = false, busy = false, done = null, shownAt = 0;
  const early = () => performance.now() - shownAt < 400; // Klicksperre nach render: Doppeltipp auf „Zur Frage“ darf keinen Joker treffen
  const cur = () => (state.usingBackup ? STATIONS[idx].backup : STATIONS[idx].question);
  const btns = () => [...root.querySelectorAll('.ans')];
  const say = (t, cls = '') => { const m = root.querySelector('.q-msg'); if (m) { m.textContent = t; m.className = 'q-msg ' + cls; } };

  function render() {
    shownAt = performance.now();
    const q = cur(), S = STATIONS[idx];
    root.innerHTML = `<div class="quiz">
      <div class="q-head"><span class="q-tag">Frage ${idx + 1} von ${STATIONS.length} · ${S.prize} €</span>${state.usingBackup ? '<span class="q-tag backup">Leichtere Frage</span>' : ''}<span class="jokers"><button class="joker" data-j="fifty">50:50</button><button class="joker" data-j="audience">Publikum</button></span></div>
      <div class="q-text"><span>${q.text}</span></div>
      <div class="answers">${q.options.map((o, i) => `<button class="ans" data-i="${i}" style="--lc:${DOTS[i].hex}" aria-label="Antwort ${LETTERS[i]}: ${o}"><span class="ans-in"><span class="letter l${i}">${LETTERS[i]}</span><span class="txt">${o}</span></span></button>`).join('')}</div>
      <p class="q-msg" aria-live="polite"></p>
    </div>`;
    btns().forEach((b, i) => (b.onclick = () => pick(i)));
    root.querySelector('[data-j=fifty]').onclick = fifty;
    root.querySelector('[data-j=audience]').onclick = audience;
    paint();
    say(state.wrong.length ? WRONG : HINT);
  }

  function paint() {
    btns().forEach((b, i) => {
      const w = state.wrong.includes(i), g = state.gone.includes(i);
      b.classList.toggle('wrong', w);
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
    say(WRONG, 'bad');
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

  function audience() {
    if (busy || early() || state.jokers.audience || !active) return;
    state.jokers.audience = true; save(); paint(); sound.tension();
    let t = 30;
    modal.innerHTML = `<div class="modal-card"><h3>Fragt die Hochzeitsgäste!</h3><p>Jetzt dürfen alle im Raum mitraten. Danach entscheidet ihr.</p><div class="timer" aria-live="off">${t}</div><button class="btn btn-gold">Weiter</button></div>`;
    modal.hidden = false;
    const timer = setInterval(() => {
      const el = modal.querySelector('.timer');
      if (!el) return clearInterval(timer);
      if (--t <= 0) { clearInterval(timer); el.textContent = 'Zeit um!'; } else el.textContent = t;
    }, 1000);
    modal.querySelector('button').onclick = () => { clearInterval(timer); modal.hidden = true; sound.click(); };
  }

  if (stage.onDotTap) stage.onDotTap((c) => pick(typeof c === 'number' ? c : DOTS.findIndex((d) => d.color === c)));

  return { ask(i) { idx = i; active = true; busy = false; render(); return new Promise((r) => (done = r)); } };
}
