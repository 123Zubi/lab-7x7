// Kleine WebAudio-Sounds, keine Audiodateien. Startet erst nach der ersten Nutzerinteraktion.
const MUTE_KEY = 'hochzeit-labyrinth-mute';
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch {}

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}
['touchend', 'click', 'keydown'].forEach((e) => addEventListener(e, unlock, { capture: true, passive: true }));

function tone(f, t, dur, { type = 'sine', vol = 0.16, to } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
const play = (fn) => {
  if (muted || !ctx) return;
  const go = () => { try { fn(ctx.currentTime); } catch {} };
  if (ctx.state === 'running') go();
  else if (ctx.state === 'suspended') ctx.resume().then(go, () => {}); // iOS: Kontext ist nach Pausen wieder suspended
};

export const sound = {
  click: () => play((t) => tone(660, t, 0.07, { type: 'triangle', vol: 0.12 })),
  right: () => play((t) => { tone(523, t, 0.15, { type: 'triangle' }); tone(784, t + 0.13, 0.35, { type: 'triangle' }); }),
  wrong: () => play((t) => { tone(220, t, 0.18, { type: 'sawtooth', vol: 0.1 }); tone(165, t + 0.16, 0.38, { type: 'sawtooth', vol: 0.1, to: 120 }); }),
  fanfare: () => play((t) => {
    [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42]].forEach(([f, d]) => tone(f, t + d, 0.3, { type: 'triangle', vol: 0.15 }));
    [[784, 0.6], [1047, 0.6], [1319, 0.6]].forEach(([f, d]) => tone(f, t + d, 0.9, { type: 'square', vol: 0.06 }));
  }),
  // Glöckchen beim Umdrehen der Karte (nutzt den freigeschalteten Kontext, folgt dem Stumm-Schalter)
  bell: () => play((t) => [[1568, 0.12], [2349, 0.06], [3136, 0.04], [1976, 0.08]].forEach(([f, v], j) => tone(f, t + 0.02 + (j === 3 ? 0.14 : 0), 1.4, { vol: v }))),
  tension: () => play((t) => {
    for (let i = 0; i < 4; i++) tone(98 + i * 2, t + i * 0.28, 0.26, { type: 'sine', vol: 0.18 });
    tone(110, t, 1.1, { type: 'triangle', vol: 0.05, to: 130 });
  }),
};

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
  return muted;
}
