// Fallback-Bühne (2D über assets/board.jpg) – implementiert die Stage-Schnittstelle aus dem Architektur-Vertrag:
//   walkTo(i, {instant}) → Promise   i: 0..3 = Station 1..4, 4 = Ziel (Podest); instant = ohne Animation platzieren
//   cheer(), showChest(r, c), highlightDot('red'|'green'|'yellow'|'blue'|null), onDotTap(cb(color)), destroy()
import { STATIONS, FINALE, DOTS } from './content.js';
import { isDebug } from './state.js';
import { ROUTE, BOARD_IMAGE } from './route.js';

const STEP_MS = 320;
const PAD_X = 16, PAD_TOP = 30, PAD_BOTTOM = 2;
const STOPS = [...STATIONS.map((s) => s.pos), FINALE.pos];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; };
const at = (n, [r, c]) => { n.style.left = ((c - 0.5) / 7) * 100 + '%'; n.style.top = ((r - 0.5) / 7) * 100 + '%'; };

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

  const couple = el('div', 'fb-couple', `<div class="couple-in">${coupleSVG()}</div>`);
  const coupleIn = couple.firstChild;
  layer.append(couple);
  let cur = route[0], curIdx = 0;
  at(couple, cur);

  let chest = null;
  const hideChest = () => { if (chest) { chest.remove(); chest = null; } };

  const fit = () => {
    const W = container.clientWidth - 2 * PAD_X, H = container.clientHeight - PAD_TOP - PAD_BOTTOM;
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
      hideChest();
      coupleIn.style.removeProperty('--ax'); coupleIn.style.removeProperty('--ay');
      const path = pathTo(STOPS[i]);
      if (instant || !path.length) {
        couple.classList.add('instant');
        at(couple, STOPS[i]);
        void couple.offsetWidth;
        couple.classList.remove('instant');
      } else {
        couple.classList.add('walking');
        for (const cell of path) { at(couple, cell); await sleep(STEP_MS); }
        couple.classList.remove('walking');
      }
      cur = STOPS[i];
    },
    cheer() {
      couple.classList.add('cheer');
      setTimeout(() => couple.classList.remove('cheer'), 1900);
    },
    showChest(r, c) {
      hideChest();
      chest = el('div', 'fb-chest', `<span class="ring"></span>${CHEST_SVG}`);
      for (let k = 0; k < 8; k++) { const s = el('span', 'spark'); s.style.setProperty('--a', k * 45 + 'deg'); chest.append(s); }
      at(chest, [r, c]);
      layer.append(chest);
      // Paar tritt einen Schritt Richtung Brettmitte zur Seite, damit die Truhe sichtbar bleibt
      const dr = 4 - cur[0], dc = 4 - cur[1];
      // Figuren sind ~1,5 Felder hoch und ~1,45 breit: Abstand so wählen, dass sie die Truhe nicht überdecken
      const [ax, ay] = Math.abs(dr) > Math.abs(dc) ? [0, dr > 0 ? 2 : -1] : dc ? [Math.sign(dc) * 1.5, 0] : [0, 2];
      coupleIn.style.setProperty('--ax', ax); coupleIn.style.setProperty('--ay', ay);
    },
    hideChest,
    highlightDot(color) { dots.forEach((d) => d.classList.toggle('lit', d.dataset.color === color)); },
    onDotTap(cb) { tapCb = cb; },
    destroy() { ro.disconnect(); container.innerHTML = ''; container.classList.remove('fb-stage'); container.style.padding = ''; },
  };
}
