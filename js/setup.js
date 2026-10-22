// Setup-Guide „Brett richtig einsetzen“ (vom Startmenü): Ausrichtung, Brettfoto mit 7x7-Raster, Tipp auf ein Feld zeigt
// das Plättchen gross und richtig gedreht (Ausschnitt aus board.jpg über BOARD_IMAGE.tileArea), Wischen/‹ › blättert.
// Verrät keine Schatzfelder: alle 49 Felder sind gleich wählbar, der Hinweis zu losen Plättchen bleibt allgemein. Offline: board.jpg liegt in der SHELL.
import { BOARD_IMAGE } from './route.js';

const A = BOARD_IMAGE.tileArea, TW = (A.x1 - A.x0) / 7, TH = (A.y1 - A.y0) / 7;
const M = 0.16;   // Rand um das Plättchen im Zoom (Anteil einer Feldbreite): Gänge der Nachbarn sieht man an
const DOT = { 'rot': [3, 3, '#e53935'], 'grün': [3, 5, '#2e9d4f'], 'gelb': [5, 3, '#f5c518'], 'blau': [5, 5, '#2f5fd0'] };

const miniSvg = () => {
  const c = (k) => 8 + (k - 0.5) * 12;
  const dots = Object.values(DOT).map(([r, cc, col]) => `<circle cx="${c(cc)}" cy="${c(r)}" r="4.2" fill="${col}" stroke="#1b1f3b" stroke-width="1.4"/>`).join('');
  const grid = Array.from({ length: 6 }, (_, k) => `<path d="M${8 + (k + 1) * 12} 8v84M8 ${8 + (k + 1) * 12}h84"/>`).join('');
  return `<svg class="st-mini" viewBox="0 0 100 100" aria-hidden="true"><rect x="8" y="8" width="84" height="84" rx="3" fill="#c9efe9" stroke="#1b1f3b" stroke-width="3"/><g stroke="#1b1f3b" stroke-opacity=".25" stroke-width="1">${grid}</g>${dots}</svg>`;
};

const HTML = `
<div class="guide-scroll"><div class="guide-inner">
  <p class="kicker">Spielbrett-Hilfe</p>
  <h2 class="guide-title" id="setup-title">Brett richtig einsetzen</h2>
  <p class="guide-intro">Ist ein Plättchen abgefallen oder verrutscht? Kein Problem – so setzt ihr es wieder richtig ein.</p>
  <h3 class="guide-h">So herum hinlegen</h3>
  <div class="st-orient">${miniSvg()}<p>Legt das Brett so hin, dass der <b class="st-red">rote Punkt oben links</b> liegt. Oben rechts ist Grün, unten links Gelb, unten rechts Blau. Dann passt es genau zum Bild unten.</p></div>
  <h3 class="guide-h">Plättchen finden</h3>
  <p class="st-p">Tippt im Bild auf das Feld, wo das Plättchen hingehört. Darunter seht ihr es gross – genau so gedreht, wie es liegen muss.</p>
  <div class="st-pick"><div class="st-board"><img src="${BOARD_IMAGE.src}" alt="Das Spielbrett von oben, roter Punkt oben links"><div class="st-grid" role="grid" aria-label="Felder des Spielbretts"></div></div>
  <div class="st-side"><div class="st-zoomwrap">
    <button class="st-nav" data-d="-1" aria-label="Vorheriges Feld">‹</button>
    <div class="st-zoom" role="img"><span class="st-tile" aria-hidden="true"></span></div>
    <button class="st-nav" data-d="1" aria-label="Nächstes Feld">›</button>
  </div>
  <p class="st-cap" aria-live="polite"></p>
  <p class="st-swipe">Wischt über das grosse Bild oder tippt auf ‹ ›, um zum nächsten Feld zu wechseln.</p></div></div>
  <h3 class="guide-h">Lose Plättchen bleiben lose</h3>
  <p class="guide-warn">Ein paar Plättchen und das goldene Podest sind absichtlich nicht festgeklebt – darunter warten eure Überraschungen. Klebt also nur Plättchen wieder fest, die vorher auch festgeklebt waren. Was lose war, bleibt lose, damit ihr es später anheben könnt.</p>
  <h3 class="guide-h">Kurzer Check</h3>
  <ul class="st-check">
    <li>Alle Gänge passen nahtlos aneinander.</li>
    <li>Kein Plättchen steht hoch oder wackelt.</li>
    <li>Das Brett liegt flach und ist gut beleuchtet, ohne starke Spiegelung.</li>
  </ul>
</div></div>
<div class="guide-foot"><button class="btn btn-gold st-done">Alles passt – zurück zum Start</button></div>`;

/** Öffnet den Guide in `root` (Section, anfangs hidden); onClose beim Schliessen. Mehrfach aufrufbar. */
export function openSetup(root, onClose = () => {}) {
  if (!root.dataset.built) {
    root.innerHTML = HTML;
    root.dataset.built = '1';
    const grid = root.querySelector('.st-grid'), zoom = root.querySelector('.st-zoom'), cap = root.querySelector('.st-cap');
    Object.assign(grid.style, { left: A.x0 * 100 + '%', top: A.y0 * 100 + '%', width: (A.x1 - A.x0) * 100 + '%', height: (A.y1 - A.y0) * 100 + '%' });
    for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) {
      grid.insertAdjacentHTML('beforeend', `<button class="st-cell" role="gridcell" data-k="${(r - 1) * 7 + c - 1}" aria-label="Reihe ${r}, Spalte ${c}"></button>`);
    }
    // Zoom: Ausschnitt Plättchen + Rand M als Hintergrund (Prozent-Position: p = u0 / (1 − Ausschnittbreite))
    const w = TW * (1 + 2 * M), h = TH * (1 + 2 * M);
    zoom.style.backgroundImage = `url("${BOARD_IMAGE.src}")`;
    zoom.style.backgroundSize = `${100 / w}% ${100 / h}%`;
    zoom.querySelector('.st-tile').style.inset = `${(M / (1 + 2 * M)) * 100}%`;
    let k = 0;
    const select = (n, focus = false) => {
      k = (n + 49) % 49;
      const r = Math.floor(k / 7) + 1, c = (k % 7) + 1;
      const u0 = A.x0 + (c - 1 - M) * TW, v0 = A.y0 + (r - 1 - M) * TH;
      zoom.style.backgroundPosition = `${(u0 / (1 - w)) * 100}% ${(v0 / (1 - h)) * 100}%`;
      zoom.setAttribute('aria-label', `Plättchen Reihe ${r}, Spalte ${c}`);
      cap.innerHTML = `<b>Reihe ${r}, Spalte ${c}</b> – so muss es liegen`;
      grid.querySelectorAll('.st-cell').forEach((b) => b.classList.toggle('on', +b.dataset.k === k));
      if (focus) grid.querySelector(`[data-k="${k}"]`).focus();
    };
    grid.onclick = (e) => { const b = e.target.closest('.st-cell'); if (b) select(+b.dataset.k); };
    grid.onkeydown = (e) => {   // Pfeiltasten im Raster
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (d) { e.preventDefault(); select(k + d, true); }
    };
    root.querySelectorAll('.st-nav').forEach((b) => (b.onclick = () => select(k + +b.dataset.d)));
    let x0 = null;   // Wischen über den Zoom: links = nächstes Feld, rechts = vorheriges
    zoom.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    zoom.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) select(k + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    zoom.addEventListener('pointercancel', () => (x0 = null));
    select(0);
  }
  root.querySelector('.st-done').onclick = () => { root.hidden = true; onClose(); };
  root.hidden = false;
  root.querySelector('.guide-scroll').scrollTop = 0;
}
