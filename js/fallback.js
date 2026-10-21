// Fallback-Bühne (2D über assets/board.jpg) – implementiert die Stage-Schnittstelle aus dem Architektur-Vertrag:
//   walkTo(i, {instant}) → Promise   i: 0..3 = Station 1..4, 4 = Ziel (Podest); instant = ohne Animation platzieren
//   cheer(), showChest(r, c), highlightDot('red'|'green'|'yellow'|'blue'|null), onDotTap(cb(color)), destroy()
//   showCard(r, c, {img, icon, theme}) → Promise<DOMRect|null>: Truhe hüpft aus dem Feld, das Paar öffnet sie, sie schwebt, der Deckel
//   klappt auf, das Stations-Icon steigt heraus und schwebt; Tipp aufs Icon (nach 1,5 s auch irgendwo aufs Brett) löst auf
//   (Rect des Icons = Startpunkt für den Kartenflug). hideCard() räumt Truhe + Icon weg. `img` (Vollbild-Karte) nutzt main.js.
import { STATIONS, FINALE, DOTS } from './content.js';
import { isDebug, state } from './state.js';
import { ROUTE, BOARD_IMAGE } from './route.js';

const STEP_MS = 320, FRAME_MS = 180;
// Sprites aus Spielfiguren/Chibi-Hochzeitspaar-Spritebogen.png (docs/ASSETS.md): gleiche Leinwand, Füsse an der Unterkante.
const POSES = ['steht', 'laeuft-1', 'laeuft-2', 'jubelt', 'hinten'];
const PAD_X = 16, PAD_TOP = 30, PAD_BOTTOM = 2;
const STOPS = [...STATIONS.map((s) => s.pos), FINALE.pos];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; };
const at = (n, [r, c]) => { n.style.left = ((c - 0.5) / 7) * 100 + '%'; n.style.top = ((r - 0.5) / 7) * 100 + '%'; };

/** Bild-Platzhalter: Ist in style.css `--img-<name>` gesetzt (z. B. url("../assets/ui/chest.png")), zeigt der Slot das Bild statt des SVG. */
export const hasImg = (name) => getComputedStyle(document.documentElement).getPropertyValue('--img-' + name).trim() !== 'none';
export const art = (name, svg, cls = '') => `<span class="art art-${name}${hasImg(name) ? ' has-img' : ''} ${cls}" aria-hidden="true">${svg}</span>`;

// Feine Linien-Icons für die Stationen (Reihenfolge = STATIONS, dann Finale). Später durch icon-*.png ersetzbar.
const ICON = (d) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const STATION_KEYS = ['weihnachtsmarkt', 'kino', 'dinner', 'spieleabend', 'flitterwochen'];
const ICONS = [
  ICON('<path d="M14 21h16v11a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M30 24h2.5a3.5 3.5 0 0 1 0 7H30"/><path d="M19 17c-1.5-2 1.5-3 0-5M25 17c-1.5-2 1.5-3 0-5"/><path d="M36 9l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z" fill="currentColor" stroke-width="1"/>'),
  ICON('<path d="M12 20h24l-3 19H15z"/><path d="M19 20l1 19M29 20l-1 19"/><circle cx="16" cy="17" r="3.2"/><circle cx="22" cy="14.5" r="3.6"/><circle cx="28.5" cy="15" r="3.4"/><circle cx="33" cy="18" r="2.8"/>'),
  ICON('<path d="M17 22h6v16h-6zM27 25h6v13h-6z"/><path d="M20 22v-2M30 25v-2"/><path d="M20 19c-2-2.5 0-5 0-7 1.8 2 2.6 4.6 0 7zM30 22c-2-2.5 0-5 0-7 1.8 2 2.6 4.6 0 7z" fill="currentColor" stroke-width="1"/><path d="M13 38h24"/>'),
  ICON('<rect x="13" y="13" width="22" height="22" rx="4.5"/><circle cx="19" cy="19" r="1.7" fill="currentColor"/><circle cx="29" cy="19" r="1.7" fill="currentColor"/><circle cx="24" cy="24" r="1.7" fill="currentColor"/><circle cx="19" cy="29" r="1.7" fill="currentColor"/><circle cx="29" cy="29" r="1.7" fill="currentColor"/>'),
  ICON('<path d="M24 38V22"/><path d="M24 22c-3-4-8-5-12-3 4 0 7 1.5 9 4M24 22c3-4 8-5 12-3-4 0-7 1.5-9 4M24 22c-1-4-4-7-8-8 3 2 5 4.5 6 8M24 22c1-4 4-7 8-8-3 2-5 4.5-6 8"/><path d="M14 38c4-2 16-2 20 0"/><path d="M33 10l4 1.5 3-2.5-1 3.5 2.5 2"/>'),
];
/** Rundes Stations-Badge (Goldrahmen + Linien-Icon), k = 0..3 Station, 4 = Finale. */
export const stationBadge = (k, cls = '') => art(STATION_KEYS[k], ICONS[k], 'badge ' + cls);

/** Brautpaar als SVG (Bräutigam im Anzug, Braut im Kleid) – auch für Start-/Sprechblasen genutzt. */
export const coupleSVG = () => `<svg class="couple-svg" viewBox="0 0 100 130" aria-hidden="true">
<ellipse cx="50" cy="119" rx="40" ry="5" fill="rgba(0,0,0,.28)"/>
<g class="groom">
 <g class="leg leg-a"><rect x="20" y="82" width="8" height="34" rx="3" fill="#18234d"/><ellipse cx="23" cy="117" rx="7" ry="3.5" fill="#0c0f1f"/></g>
 <g class="leg leg-b"><rect x="30" y="82" width="8" height="34" rx="3" fill="#18234d"/><ellipse cx="35" cy="117" rx="7" ry="3.5" fill="#0c0f1f"/></g>
 <rect x="14" y="44" width="30" height="44" rx="7" fill="#1f2f66"/>
 <polygon points="22,45 36,45 29,68" fill="#fff"/>
 <polygon points="25,47 29,50 25,53" fill="#c1121f"/><polygon points="33,47 29,50 33,53" fill="#c1121f"/>
 <circle cx="29" cy="63" r="1.6" fill="#f5c542"/><circle cx="29" cy="71" r="1.6" fill="#f5c542"/>
 <g class="arm arm-l" style="transform-origin:15px 49px"><rect x="8" y="46" width="8" height="32" rx="4" fill="#1f2f66"/><circle cx="12" cy="80" r="4.5" fill="#f2c6a0"/></g>
 <g class="arm arm-r" style="transform-origin:43px 49px"><rect x="42" y="46" width="8" height="32" rx="4" fill="#1f2f66"/><circle cx="46" cy="80" r="4.5" fill="#f2c6a0"/></g>
 <circle cx="29" cy="31" r="13" fill="#f2c6a0"/>
 <path d="M16 30 Q15 14 29 14 Q43 14 42 30 Q37 21 29 22 Q21 21 16 30Z" fill="#3a2718"/>
 <circle cx="24.5" cy="32" r="1.6" fill="#2b1d12"/><circle cx="33.5" cy="32" r="1.6" fill="#2b1d12"/>
 <path d="M24 37.5 Q29 42 34 37.5" stroke="#a5503a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</g>
<g class="bride">
 <ellipse cx="72" cy="38" rx="16" ry="20" fill="#6b3f22"/>
 <path d="M57 26 Q72 6 87 26 L94 76 Q72 66 50 76 Z" fill="#fff" opacity=".6"/>
 <g class="arm arm-l" style="transform-origin:58px 49px"><rect x="54" y="46" width="7" height="30" rx="3.5" fill="#f2c6a0"/></g>
 <path d="M63 46 L81 46 L84 70 L99 118 L45 118 L60 70 Z" fill="#fffdf6" stroke="#e3d9c0" stroke-width="1.2"/>
 <rect x="60" y="68" width="24" height="4" fill="#f5c542"/>
 <g class="arm arm-r" style="transform-origin:86px 49px"><rect x="83" y="46" width="7" height="30" rx="3.5" fill="#f2c6a0"/></g>
 <g><circle cx="72" cy="80" r="5" fill="#ff8fb1"/><circle cx="67" cy="84" r="4" fill="#ffd1e0"/><circle cx="77" cy="84" r="4" fill="#ff8fb1"/><circle cx="72" cy="87" r="3.5" fill="#fff"/><path d="M72 90 L72 98" stroke="#3f8f4a" stroke-width="2"/></g>
 <circle cx="72" cy="31" r="13" fill="#f2c6a0"/>
 <path d="M59 30 Q58 15 72 15 Q86 15 85 30 Q79 22 72 23 Q65 22 59 30Z" fill="#6b3f22"/>
 <path d="M64 15 L68 9 L72 14 L76 9 L80 15Z" fill="#f5c542"/>
 <circle cx="67.500" cy="32" r="1.6" fill="#2b1d12"/><circle cx="76.500" cy="32" r="1.6" fill="#2b1d12"/>
 <circle cx="63.500" cy="36" r="2.4" fill="#ff8fb1" opacity=".5"/><circle cx="80.500" cy="36" r="2.4" fill="#ff8fb1" opacity=".5"/>
 <path d="M67 37.500 Q72 42 77 37.500" stroke="#a5503a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</g></svg>`;

const CHEST_SVG = `<svg viewBox="0 0 64 56" aria-hidden="true"><rect x="6" y="24" width="52" height="28" rx="4" fill="#8a4b12" stroke="#4a2605" stroke-width="2"/>
<path d="M6 26 Q6 8 32 8 Q58 8 58 26Z" fill="#a85e17" stroke="#4a2605" stroke-width="2"/><rect x="6" y="24" width="52" height="5" fill="#f5c542"/>
<rect x="14" y="14" width="6" height="38" fill="#f5c542"/><rect x="44" y="14" width="6" height="38" fill="#f5c542"/>
<rect x="27" y="22" width="10" height="13" rx="2" fill="#ffe08a" stroke="#4a2605" stroke-width="1.5"/><circle cx="32" cy="28" r="2" fill="#4a2605"/></svg>`;

// Truhe mit eigenem Deckel (klappt per CSS auf); innen ein Goldschein, der beim Öffnen sichtbar wird.
const TREASURE_SVG = `<svg viewBox="0 0 64 60" aria-hidden="true">
<ellipse class="glowin" cx="32" cy="31" rx="21" ry="7" fill="#fff1b8"/>
<g class="body"><rect x="6" y="30" width="52" height="26" rx="4" fill="#8a4b12" stroke="#4a2605" stroke-width="2"/><rect x="6" y="30" width="52" height="5" fill="#e3c77d"/>
<rect x="14" y="30" width="6" height="26" fill="#e3c77d"/><rect x="44" y="30" width="6" height="26" fill="#e3c77d"/>
<rect x="27" y="31" width="10" height="12" rx="2" fill="#f1dc9f" stroke="#4a2605" stroke-width="1.5"/><circle cx="32" cy="37" r="1.8" fill="#4a2605"/></g>
<g class="lid"><path d="M6 32 Q6 13 32 13 Q58 13 58 32Z" fill="#a85e17" stroke="#4a2605" stroke-width="2"/><rect x="14" y="16" width="6" height="16" fill="#e3c77d"/><rect x="44" y="16" width="6" height="16" fill="#e3c77d"/></g></svg>`;

export async function createFallbackStage(container) {
  const debug = isDebug();
  const route = ROUTE, { src, tileArea: area } = BOARD_IMAGE;
  const img = await loadImg(src);
  const showGrid = !img || debug;
  const idx = (p) => route.findIndex((q) => same(q, p));

  container.innerHTML = '';
  container.classList.add('fb-stage');
  container.style.padding = `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`; // Platz, damit das Paar am Brettrand nicht abgeschnitten wird
  const board = el('div', 'fb-board' + (img ? '' : ' placeholder'));
  if (img) { img.className = 'fb-img'; img.alt = 'Spielbrett'; img.draggable = false; board.append(img); }
  const layer = el('div', 'fb-layer');
  Object.assign(layer.style, { left: area.x0 * 100 + '%', top: area.y0 * 100 + '%', width: (area.x1 - area.x0) * 100 + '%', height: (area.y1 - area.y0) * 100 + '%' });
  board.append(layer);
  container.append(board);

  if (showGrid) {
    for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) {
      const corner = (r === 1 || r === 7) && (c === 1 || c === 7);
      const cell = el('div', 'fb-cell' + ((r + c) % 2 ? ' dark' : '') + (corner ? ' corner' : '') + (r === 4 && c === 4 ? ' center' : ''));
      cell.style.left = ((c - 1) / 7) * 100 + '%';
      cell.style.top = ((r - 1) / 7) * 100 + '%';
      if (debug) { const k = idx([r, c]); cell.innerHTML = `<span>${r},${c}${k >= 0 ? `<br>#${k}` : ''}</span>`; }
      layer.append(cell);
    }
  }

  let tapCb = null;
  const dots = DOTS.map((d) => {
    const b = el('button', 'fb-dot' + (showGrid ? ' vis' : ''));
    b.style.setProperty('--c', d.hex);
    b.dataset.color = d.color;
    b.setAttribute('aria-label', 'Farbpunkt ' + d.label);
    at(b, d.pos);
    b.addEventListener('click', () => tapCb && tapCb(d.color));
    layer.append(b);
    return b;
  });

  // Geheimfelder: erst sichtbar, wenn das Paar dort steht; gelöste bleiben dezent markiert. ?debug=1 zeigt alle.
  let here = -1, going = -1;   // going: Ziel des laufenden Wegs – dessen Feld bleibt geheim, bis das Paar ankommt
  const marks = STOPS.slice(0, 4).map((p) => { const m = el('div', 'fb-mark' + (debug ? ' debug' : '')); at(m, p); layer.append(m); return m; });
  const paintMarks = () => marks.forEach((m, k) => {
    const solved = state.solved.includes(k);
    m.classList.toggle('here', k === here);             // Feld „offen“, solange das Paar dort steht
    m.classList.toggle('solved', solved && k !== here && k !== going);
  });

  // Alle 5 Posen liegen als <img> übereinander (vorgeladen, kein Flackern); sichtbar ist nur die mit .on.
  const couple = el('div', 'fb-couple', `<div class="couple-in">${POSES.map((p) => `<img class="fig" data-p="${p}" src="assets/ui/figur-${p}.png" alt="" draggable="false">`).join('')}</div>`);
  const coupleIn = couple.firstChild, figs = [...coupleIn.children];
  const pose = (p, flip = false) => { figs.forEach((f) => f.classList.toggle('on', f.dataset.p === p)); coupleIn.classList.toggle('flip', flip); };
  pose('steht');
  layer.append(couple);
  let cur = route[0], curIdx = 0;
  at(couple, cur);

  let chest = null;
  const hideChest = () => { if (chest) { chest.remove(); chest = null; } };
  const stepAside = () => { // Paar tritt knapp eine Feldbreite Richtung Brettmitte neben die Truhe: beide Figuren und die Truhe bleiben sichtbar
    const dc = Math.sign(4 - cur[1]) || 1;
    coupleIn.style.setProperty('--ax', dc * 0.95); coupleIn.style.setProperty('--ay', 0.3);
  };

  let cheerEnd = 0;
  const cheer = () => {
    clearTimeout(cheerEnd);
    pose('jubelt'); couple.classList.add('cheer');
    cheerEnd = setTimeout(() => { couple.classList.remove('cheer'); if (!couple.classList.contains('walking')) pose('steht'); }, 1900);
  };
  let card = null, cardDone = null, anyTap = null, cheerT = 0;
  function hideCard() {
    clearTimeout(cheerT);
    if (card) { card.remove(); card = null; here = -1; paintMarks(); }
    if (anyTap) { container.removeEventListener('click', anyTap); anyTap = null; }
    if (cardDone) { const d = cardDone; cardDone = null; d(); }
  }
  function showCard(r, c, { icon = null, theme } = {}) {
    hideChest(); hideCard();
    paintMarks();
    const k = Math.max(0, STATION_KEYS.indexOf(theme));
    card = el('div', 'fb-treasure');
    card.innerHTML = `<span class="ring"></span>${art('chest', TREASURE_SVG, 'fb-tchest')}
      <button class="fb-ticon" aria-label="Schatz antippen"><span class="fb-ticon-in badge${icon ? ' has-img' : ''}">${icon ? `<img src="${icon}" alt="" draggable="false">` : ICONS[k]}</span></button>`;
    for (let j = 0; j < 10; j++) { const sp = el('span', 'spark'); sp.style.setProperty('--a', j * 36 + 'deg'); card.append(sp); }
    at(card, [r, c]);
    layer.append(card);
    stepAside();
    cheerT = setTimeout(cheer, 700);   // das Paar „öffnet“ die Truhe
    return new Promise((res) => {
      const me = card;
      const done = () => { const rect = me.querySelector('.fb-ticon-in').getBoundingClientRect(); hideCard(); res(rect); };
      cardDone = () => res(null);
      const t0 = performance.now();   // Icon steigt erst ab 1,7 s auf: vorher zählt ein Tipp darauf nicht
      me.querySelector('.fb-ticon').addEventListener('click', (e) => { if (performance.now() - t0 < 1700) return; e.stopPropagation(); done(); });
      setTimeout(() => { if (card !== me) return; anyTap = done; container.addEventListener('click', anyTap); }, 1500);   // nach 1,5 s zählt jeder Tipp aufs Brett
    });
  }

  const fit = () => {
    const cs = getComputedStyle(container);   // Polster aus dem CSS lesen: style.css schiebt das Brett unter den Kamera-Chip
    const W = container.clientWidth - 2 * PAD_X, H = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!W || !H) return;
    const asp = img ? img.naturalWidth / img.naturalHeight : 1;
    let w = W, h = W / asp;
    if (h > H) { h = H; w = H * asp; }
    board.style.width = w + 'px';
    board.style.height = h + 'px';
    layer.style.setProperty('--cell', layer.clientWidth / 7 + 'px');
  };
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  // Zielindex in ROUTE: erstes Vorkommen ab dem aktuellen Index (Feld (7,3) kommt wegen der Sackgasse doppelt vor),
  // sonst irgendein Vorkommen (Rückwärtslauf, z. B. Debug-Sprung), sonst -1 (nicht auf der Route).
  function findIdx(p, from) {
    for (let k = Math.max(from, 0); k < route.length; k++) if (same(route[k], p)) return k;
    return idx(p);
  }
  function pathTo(p) {
    const j = findIdx(p, curIdx);
    if (j >= 0 && curIdx >= 0) { const out = j >= curIdx ? route.slice(curIdx + 1, j + 1) : route.slice(j, curIdx).reverse(); curIdx = j; return out; }
    const out = []; let [r, c] = cur; // ponytail: Luftlinie in L-Form, falls Feld nicht auf der Route liegt (nur Platzhalter-Route)
    while (r !== p[0]) { r += Math.sign(p[0] - r); out.push([r, c]); }
    while (c !== p[1]) { c += Math.sign(p[1] - c); out.push([r, c]); }
    curIdx = j;
    return out;
  }

  return {
    isAr: false,
    async walkTo(i, { instant = false } = {}) {
      hideChest(); hideCard();
      here = -1; going = i; paintMarks();
      coupleIn.style.removeProperty('--ax'); coupleIn.style.removeProperty('--ay');
      const path = pathTo(STOPS[i]);
      if (instant || !path.length) {
        couple.classList.add('instant');
        at(couple, STOPS[i]);
        void couple.offsetWidth;
        couple.classList.remove('instant');
      } else {
        // Richtung je Schritt: rechts = läuft 1/2, links = gespiegelt, hoch = von hinten, runter = steht (beide mit Wippen per CSS)
        clearTimeout(cheerEnd); couple.classList.remove('cheer');
        couple.classList.add('walking');
        let dir = 'r', frame = 0, prev = cur;
        const face = () => { coupleIn.dataset.dir = dir; pose(dir === 'u' ? 'hinten' : dir === 'd' ? 'steht' : 'laeuft-' + (frame + 1), dir === 'l'); };
        const tick = setInterval(() => { frame ^= 1; face(); }, FRAME_MS);
        for (const cell of path) {
          const dr = cell[0] - prev[0], dc = cell[1] - prev[1];
          dir = dc > 0 ? 'r' : dc < 0 ? 'l' : dr < 0 ? 'u' : 'd';
          face(); at(couple, cell); prev = cell;
          await sleep(STEP_MS);
        }
        clearInterval(tick);
        couple.classList.remove('walking'); delete coupleIn.dataset.dir;
        pose('steht');
      }
      cur = STOPS[i];
      if (going === i) going = -1;
      here = i; paintMarks();
    },
    cheer,
    showChest(r, c) {
      hideChest();
      paintMarks();
      chest = el('div', 'fb-chest', `<span class="ring"></span>${art('chest', CHEST_SVG)}`);
      for (let k = 0; k < 8; k++) { const s = el('span', 'spark'); s.style.setProperty('--a', k * 45 + 'deg'); chest.append(s); }
      at(chest, [r, c]);
      layer.append(chest);
      stepAside();
    },
    hideChest,
    showCard,
    hideCard,
    highlightDot(color) { dots.forEach((d) => d.classList.toggle('lit', d.dataset.color === color)); },
    onDotTap(cb) { tapCb = cb; },
    destroy() { clearTimeout(cheerEnd); hideCard(); ro.disconnect(); container.innerHTML = ''; container.classList.remove('fb-stage'); container.style.padding = ''; },
  };
}
