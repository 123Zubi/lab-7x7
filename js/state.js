// Fortschritt im localStorage (Vertrag: Key hochzeit-labyrinth-v1).
// station: 0 = Intro, 1..4 = aktuelle Station (Frage offen oder Schatz noch nicht bestätigt), 5 = Finale
// solved: gelöste Stationen (0-basiert). wrong/gone: Markierungen der aktuellen Frage. jokers: je einmal pro Spiel.
const KEY = 'hochzeit-labyrinth-v1';
const fresh = () => ({
  station: 0, wrongCount: 0, usingBackup: false, solved: [],
  wrong: [], gone: [], jokers: { fifty: false, audience: false }, done: false, mode: null,
});

const params = new URLSearchParams(location.search);
export const isDebug = () => params.get('debug') === '1';

if (params.get('reset') === '1') {
  try { localStorage.removeItem(KEY); } catch {}
  params.delete('reset');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
}

function read() {
  try {
    const s = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY)) };
    s.jokers = { ...fresh().jokers, ...s.jokers };
    return s;
  } catch { return fresh(); }
}

export const state = read();
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
export function reset() { Object.assign(state, fresh()); save(); }
