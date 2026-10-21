// Fortschritt im localStorage (Vertrag: Key hochzeit-labyrinth-v1).
// station: 0 = Intro, 1..4 = aktuelle Station (Frage offen oder Schatz noch nicht bestätigt), 5 = Finale
// solved: gelöste Fragen (0-basiert, 4 = Hauptschatz-Frage). wrong/gone: Markierungen der aktuellen Frage. jokers: 50:50 einmal pro Spiel.
// qs: die 5 gezogenen Fragen dieses Spiels (Antworten schon gemischt), damit ein Reload dieselben Fragen zeigt.
// usingBackup: aktuelle Station zeigt die Backup-Frage; extra: weitere Ersatzfrage (nach 2 Fehlern auch bei der Backup-Frage),
// extraIds: alle in diesem Spiel als Ersatz gezogenen Pool-IDs (keine Wiederholung innerhalb eines Spiels).
const KEY = 'hochzeit-labyrinth-v1';
const fresh = () => ({
  station: 0, wrongCount: 0, usingBackup: false, solved: [],
  wrong: [], gone: [], jokers: { fifty: false }, done: false, mode: null, qs: null, extra: null, extraIds: [],
});

const params = new URLSearchParams(location.search);
export const isDebug = () => params.get('debug') === '1';

// Gespielte Fragen-IDs (eigener Key): überlebt ?reset=1 und „Nochmals spielen“, nur ?reset=all löscht ihn.
export const PLAYED_KEY = 'hochzeit-labyrinth-fragen-v1';
if (params.get('reset') === '1' || params.get('reset') === 'all') {
  try { localStorage.removeItem(KEY); if (params.get('reset') === 'all') localStorage.removeItem(PLAYED_KEY); } catch {}
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
