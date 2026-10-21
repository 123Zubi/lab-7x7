// AR-Bühne: MindAR 1.2.5 (Image Tracking) + A-Frame 1.5.0, Stage-Schnittstelle wie fallback.js / docs/ARCHITEKTUR.md:
//   walkTo(i, {instant}) → Promise   i: 0..3 = Station 1..4, 4 = Ziel; instant = direkt hinsetzen (Reload)
//   cheer(), showCard(r, c, {icon, theme}) → Promise<DOMRect>, hideCard(), reset(), showChest(r, c), hideChest(), highlightDot('red'|'green'|'yellow'|'blue'|null), onDotTap(cb(color)), destroy()
// Koordinaten: MindAR-Ziel = Bild 1 Einheit breit, Mitte 0, x rechts, y oben, z aus dem Brett heraus (zur Kamera).
// Stehende Objekte (Paar, Truhe, Stern) hängen in der Gruppe `up` (rotation.x = 90°): dort ist y = senkrecht zum Brett,
// x = Bild-x, z = −Bild-y (also +z = Richtung Reihe 7). Ablauf/Kalibrierung: docs/AR.md.
import { ROUTE, TARGET_TILE_AREA } from './route.js';
import { STATIONS, FINALE, DOTS } from './content.js';
import { registerCouple } from './couple3d.js';

const AFRAME_SRC = 'https://aframe.io/releases/1.5.0/aframe.min.js';
const MINDAR_SRC = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
const STEP_S = 0.6;        // Sekunden pro Feld
const COUPLE_H = 0.12;     // Paar-Höhe in Zieleinheiten (Modell ist 1.0 hoch)
const PODIUM_H = 0.05;     // ponytail: geschätzte Höhe des goldenen Podests auf (4,4); am echten Brett mit ?debug=1 nachjustieren
const DOT_R = 0.026;       // Radius der echten Farbpunkte (inkl. Goldrand ≈ 0.03)
const GERMAN = { rot: 'red', gruen: 'green', grün: 'green', gelb: 'yellow', blau: 'blue' };

/** Feldmitte (reihe, spalte) → MindAR-Zielkoordinaten. aspect = Bildhöhe / Bildbreite. */
export function cellToTarget(r, c, aspect = 1, a = TARGET_TILE_AREA) {
  const u = a.x0 + ((a.x1 - a.x0) * (c - 0.5)) / 7;
  const v = a.y0 + ((a.y1 - a.y0) * (r - 0.5)) / 7;
  return { x: u - 0.5, y: (0.5 - v) * aspect };
}

/** ROUTE-Index jeder Station; gesucht ab der vorherigen Station, weil Felder (z. B. (7,3)) doppelt vorkommen. */
export function stopIndices(route, stops) {
  const find = (p, from) => route.findIndex((q, k) => k >= from && q[0] === p[0] && q[1] === p[1]);
  let from = 0;
  return stops.map((p) => {
    let k = find(p, from);
    if (k < 0) k = find(p, 0);            // Station nicht in Laufrichtung: notfalls rückwärts laufen
    if (k >= 0) from = k;
    return k;
  });
}

const named = (name, msg) => Object.assign(new Error(msg), { name });
const loadScript = (src) => new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = src; s.onload = res;
  s.onerror = () => rej(named('CdnError', 'Skript nicht ladbar: ' + src));
  document.head.append(s);
});
const gum = () => navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
/** Lädt das Bildziel vorab: fehlt es oder ist es kaputt, sofort ein benannter Fehler statt langem Warten. */
async function checkTargets(src) {
  let b = null;
  try { const r = await fetch(src); if (r.ok) b = new Uint8Array(await r.arrayBuffer()); } catch { /* offline o. ä. */ }
  // .mind = msgpack-Map {v, dataList}: erstes Byte 0x80–0x8f
  if (!b || b.length < 1000 || (b[0] & 0xf0) !== 0x80) throw named('TargetError', 'Bildziel fehlt oder ist kaputt: ' + src);
}
const once = (el, ev) => new Promise((res) => el.addEventListener(ev, res, { once: true }));
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * Baut Paar, Marker, Truhe, Farbpunkte und Debug-Overlay unter `anchor` (THREE.Object3D in Zielkoordinaten)
 * und liefert die Stage-Schnittstelle. Wird von createArStage und von dev/ar-sim.html benutzt.
 */
export async function buildBoard({ sceneEl, anchor, aspect = 1, debug = false, isTracking = () => true }) {
  const AF = window.AFRAME, THREE = AF.THREE;
  registerCouple(AF);
  const cell = (TARGET_TILE_AREA.x1 - TARGET_TILE_AREA.x0) / 7;
  const T = (r, c) => cellToTarget(r, c, aspect);
  const U = (r, c) => { const p = T(r, c); return new THREE.Vector3(p.x, r === 4 && c === 4 ? PODIUM_H : 0, -p.y); };
  const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, ...o });
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...o });

  const root = new THREE.Group();
  anchor.add(root);
  const up = new THREE.Group();
  up.rotation.x = Math.PI / 2;
  root.add(up);

  root.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(0.4, 1.2, 0.8);
  up.add(sun, sun.target);

  // --- Brautpaar (A-Frame-Komponente, object3D in `up` umgehängt) ---
  const coupleEl = document.createElement('a-entity');
  coupleEl.setAttribute('couple', 'anim: idle');
  sceneEl.appendChild(coupleEl);
  if (!coupleEl.hasLoaded) await once(coupleEl, 'loaded');
  const holder = new THREE.Group();
  up.add(holder);
  holder.add(coupleEl.object3D);
  coupleEl.object3D.scale.setScalar(COUPLE_H);
  const setAnim = (a) => coupleEl.components.couple && coupleEl.components.couple.setAnim(a);

  // --- Station-Ringe (flach) + goldener Stern über (4,4) ---
  // Geheim: Ring k erscheint erst, wenn das Paar auf Station k ankommt (danach dezent), der Stern erst am Ziel. ?debug=1 zeigt alles.
  const STOPS = [...STATIONS.map((s) => s.pos), FINALE.pos];
  const stops = stopIndices(ROUTE, STOPS);
  const rings = STATIONS.map((s) => {
    const p = T(...s.pos);
    const m = new THREE.Mesh(new THREE.RingGeometry(cell * 0.34, cell * 0.44, 40), basic(0xffe08a, { opacity: 0.5 }));
    m.position.set(p.x, p.y, 0.003);
    root.add(m);
    return m;
  });
  const starShape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 ? 0.015 : 0.036, a = Math.PI / 2 + (k * Math.PI) / 5;
    k ? starShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : starShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.008, bevelEnabled: false });
  starGeo.center();
  const star = new THREE.Mesh(starGeo, std(0xf5c542, { metalness: 0.5, roughness: 0.35, emissive: 0x7a5200 }));
  star.position.copy(U(4, 4)).add(new THREE.Vector3(0, 0.17, 0));
  up.add(star);

  // --- Farbpunkte: Leuchten + unsichtbare Tippflächen ---
  const dots = DOTS.map((d) => {
    const p = T(...d.pos);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, 0.004);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(DOT_R * 1.5, 32), basic(d.hex, { opacity: 0.6 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(DOT_R * 1.6, DOT_R * 2.1, 40), basic(0xffffff, { opacity: 0.9 }));
    const lit = new THREE.Group();
    lit.add(glow, ring);
    lit.visible = false;
    const hit = new THREE.Mesh(new THREE.CircleGeometry(cell * 0.6, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.color = d.color;
    g.add(lit, hit);
    if (debug) {   // virtueller Punkt: muss genau auf dem echten liegen
      const v = new THREE.Mesh(new THREE.RingGeometry(DOT_R * 0.95, DOT_R * 1.25, 40), basic(0xffffff, { opacity: 1 }));
      const c = new THREE.Mesh(new THREE.RingGeometry(DOT_R * 0.55, DOT_R * 0.95, 40), basic(d.hex, { opacity: 1 }));
      g.add(v, c);
    }
    root.add(g);
    return { color: d.color, lit, hit };
  });

  if (debug) root.add(makeDebugOverlay(THREE, aspect));

  // Goldenes, weiches Leuchten (Textur geteilt; Material je Objekt wegen eigener Deckkraft)
  let glowTex = null;
  function glowMat() {
    if (!glowTex) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const cg = cv.getContext('2d'), grad = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,240,170,1)'); grad.addColorStop(0.4, 'rgba(255,200,60,.55)'); grad.addColorStop(1, 'rgba(255,180,0,0)');
      cg.fillStyle = grad; cg.fillRect(0, 0, 64, 64);
      glowTex = new THREE.CanvasTexture(cv);
    }
    return new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  }
  // Paar tritt einen halben Schritt Richtung Brettmitte (am Ziel: Richtung Reihe 7) und schaut aufs Feld (r,c)
  function stepAside(r, c) {
    const cp = U(r, c), d = U(4, 4).sub(cp).setY(0);
    if (d.lengthSq() < 1e-8) d.set(0, 0, 1);
    const side = cp.clone().add(d.normalize().multiplyScalar(cell * 0.75));
    side.y = r === 4 && c === 4 ? 0 : cp.y;
    moveAlong([side], 0.4).then(() => { if (!move) want = headTo(pos, cp); });
  }

  // --- Schatz: Truhe hüpft aus dem Feld, Paar öffnet sie, Truhe schwebt, Deckel auf, Stations-Icon steigt auf ---
  // Antippen des Icons (oder nach 1,5 s irgendwo) löst das Promise von showCard mit dem Bildschirm-Rechteck des Icons auf.
  const imgCache = new Map();   // genau ein Ladeversuch pro Datei, Ergebnis gecacht (fehlende Datei → einmal 404, dann Platzhalter)
  const loadImg = (src) => {
    if (!src) return Promise.resolve(null);
    if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    }));
    return imgCache.get(src);
  };
  const EMOJI = { weihnachtsmarkt: '🎄', kino: '🍿', dinner: '🕯️', spieleabend: '🎲', flitterwochen: '🌴' };
  const ICON_R = 0.036;
  /** Badge-Textur: fertiges PNG (eigene Transparenz) oder gezeichneter Platzhalter mit Goldring, Elfenbein und Motiv je Thema. */
  function badgeTexture(img, theme) {
    if (img) {   // fertiger Badge (PNG mit Transparenz): unverändert, quadratisch
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }
    const N = 256, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d'), m = N / 2;
    const circle = (r) => { g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); };
    const gold = g.createLinearGradient(0, 0, N, N);
    gold.addColorStop(0, '#f7e39a'); gold.addColorStop(0.45, '#c9962b'); gold.addColorStop(0.7, '#f5d77a'); gold.addColorStop(1, '#a8761c');
    circle(m); g.fillStyle = gold; g.fill();
    const ivory = g.createRadialGradient(m, m * 0.85, 10, m, m, m);
    ivory.addColorStop(0, '#fffdf6'); ivory.addColorStop(1, '#f1e4c2');
    circle(m - 16); g.fillStyle = ivory; g.fill();
    circle(m - 26); g.strokeStyle = gold; g.lineWidth = 3; g.stroke();
    for (let k = 0; k < 12; k++) {   // kleine Goldperlen im Ring
      const a = (k / 12) * Math.PI * 2;
      g.beginPath(); g.arc(m + Math.cos(a) * (m - 8), m + Math.sin(a) * (m - 8), 3.5, 0, Math.PI * 2); g.fillStyle = '#fff4c4'; g.fill();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '112px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.fillStyle = '#a8761c';
    g.fillText(EMOJI[theme] || '♥', m, m + 6);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeChest() {
    const W = 0.08, D = 0.054, H = 0.042, R = D / 2;
    const g = new THREE.Group(), s = new THREE.Group();   // g: Feld + Blickrichtung, s: Hüpfen/Schweben/Wackeln
    g.add(s);
    const wood = std(0x84461a), dark = std(0x4a2710), lidWood = std(0x95521d, { side: THREE.DoubleSide });
    const gold = std(0xf5c542, { metalness: 0.6, roughness: 0.35, emissive: 0x5a3c00 });
    const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); s.add(o); return o; };
    box(W, H, D, wood, 0, H / 2, 0);                                  // Kasten
    box(W + 0.002, 0.003, D + 0.002, dark, 0, H * 0.45, 0);           // Brettfuge
    box(W + 0.005, 0.005, D + 0.005, gold, 0, 0.0025, 0);             // Goldsockel
    box(W + 0.004, 0.004, D + 0.004, gold, 0, H - 0.0015, 0);         // Goldrand oben (ragt 0,5 mm über den Kasten: kein Z-Fighting)
    for (const x of [-W * 0.3, W * 0.3]) box(0.008, H + 0.002, D + 0.003, gold, x, H / 2, 0);   // Beschläge
    box(W * 0.88, 0.008, D * 0.8, std(0xffd54a, { emissive: 0xffb300, emissiveIntensity: 0.8, metalness: 0.5 }), 0, H - 0.0055, 0);   // Goldfüllung (Oberkante unter dem Rand: kein Z-Fighting)
    box(0.016, 0.018, 0.004, gold, 0, H - 0.009, D / 2 + 0.002);     // Schloss
    box(0.003, 0.007, 0.002, dark, 0, H - 0.011, D / 2 + 0.0045);    // Schlüsselloch
    const lid = new THREE.Group();
    lid.position.set(0, H, -R);                                         // Scharnier hinten oben
    const lm = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), lidWood);
    lm.position.z = R;
    lid.add(lm);
    for (const x of [-W * 0.3, W * 0.3]) {
      const lb = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0015, R + 0.0015, 0.008, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), gold);
      lb.position.set(x, 0, R);
      lid.add(lb);
    }
    s.add(lid);
    const glow = new THREE.Sprite(glowMat());   // Goldglanz aus der offenen Truhe
    glow.position.y = H + 0.012;
    s.add(glow);
    const sparks = Array.from({ length: 6 }, () => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.005), basic(0xffe27a, { opacity: 0 }));
      s.add(m);
      return m;
    });
    Object.assign(g.userData, { s, lid, glow, sparks, H });
    return g;
  }

  let treasure = null;   // { g, u: {...} }
  /** Truhe (+ optional Icon) auf Feld (r,c). icon: { src, theme } oder null (alte showChest-Variante). */
  function showTreasure(r, c, icon) {
    hideCard(true);
    const g = makeChest(), cp = U(r, c);
    g.position.copy(cp);
    const cl = camInUp();
    if (cl) g.rotation.y = Math.atan2(cl.x - cp.x, cl.z - cp.z);   // Schloss zur Kamera
    up.add(g);
    const u = Object.assign(g.userData, { t0: time, resolve: () => {}, cheered: 0, icon: null });
    if (icon) {
      // ig: Position/Grösse, Ausrichtung einmal zur Kamera; spin: pendelt ±25° um die Hochachse.
      // Beidseitig: zweites Mesh um 180° gedreht mit demselben Material → Rückseite zeigt das Bild ungespiegelt.
      const ig = new THREE.Group(), spin = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ map: badgeTexture(null, icon.theme), transparent: true, alphaTest: 0.1 });   // weiche Kanten, Ränder ohne Tiefen-Loch
      const geo = new THREE.PlaneGeometry(ICON_R * 2, ICON_R * 2);
      const disc = new THREE.Mesh(geo, mat), back = new THREE.Mesh(geo, mat);
      back.rotation.y = Math.PI;
      disc.name = 'icon-front'; back.name = 'icon-back';
      disc.renderOrder = back.renderOrder = 1;   // nach dem Glanz: deckt ihn ab
      const hit = new THREE.Mesh(new THREE.CircleGeometry(ICON_R * 2, 16), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));   // grosszügig, von beiden Seiten
      const halo = new THREE.Sprite(glowMat());
      halo.scale.setScalar(ICON_R * 4);
      spin.add(disc, back, hit);
      ig.add(halo, spin);
      ig.visible = false;
      up.add(ig);   // nicht in g: soll nicht mitwackeln, nur über der Truhe stehen
      u.icon = { g: ig, spin, disc, hit, halo, aimed: false };
      loadImg(icon.src).then((im) => {
        if (im && treasure && treasure.u === u) { mat.map.dispose(); mat.map = badgeTexture(im, icon.theme); mat.needsUpdate = true; }
      });
    }
    treasure = { g, u };
    stepAside(r, c);
    return u;
  }
  function hideCard(now = false) {
    if (!treasure) return;
    const { g, u } = treasure;
    u.resolve(null);
    if (now) { up.remove(g); if (u.icon) up.remove(u.icon.g); treasure = null; return; }
    if (u.hideT == null) u.hideT = time;
  }
  const hideChest = () => hideCard(true);
  const camPos = new THREE.Vector3();
  function animTreasure() {
    const { g, u } = treasure, { s, lid, glow, sparks, H } = u, t = time - u.t0;
    let out = 1;
    if (u.hideT != null) {
      const h = clamp01((time - u.hideT) / 0.25);
      out = 1 - smooth(h);
      if (h >= 1) { up.remove(g); if (u.icon) up.remove(u.icon.g); treasure = null; return; }
    }
    // 1) hüpft aus dem Feld  2) Paar „öffnet“ (Jubel-Geste zur Truhe)  3) hebt ab und schwebt  4) Deckel auf, Glanz, Funken
    const pop = clamp01((t - 0.1) / 0.45), hop = Math.max(0, Math.sin(clamp01((t - 0.1) / 0.6) * Math.PI)) * 0.05;
    if (u.cheered === 0 && t > 0.7) { u.cheered = 1; if (!move) setAnim('cheer'); }
    if (u.cheered === 1 && t > 1.6) { u.cheered = 2; if (!move) setAnim('idle'); }
    const lift = smooth((t - 0.9) / 0.6);
    s.scale.setScalar(Math.max(0.001, easeOutBack(pop) * out));
    s.position.y = hop + lift * (0.035 + Math.sin(time * 2.2) * 0.005);
    s.rotation.z = Math.sin(time * 1.7) * 0.07 * lift;
    s.rotation.x = Math.sin(time * 1.3 + 1) * 0.04 * lift;
    lid.rotation.x = -1.95 * smooth((t - 1.2) / 0.5);
    const gk = smooth((t - 1.35) / 0.4), pulse = Math.sin(time * 6);
    glow.material.opacity = gk * (0.55 + 0.15 * pulse);
    glow.scale.setScalar(0.02 + 0.07 * gk * (1 + 0.08 * pulse));
    sparks.forEach((m, j) => {
      const ph = (t * 0.6 + j / sparks.length) % 1, a = j * 2.4;
      m.position.set(Math.cos(a) * 0.02 * (1 + ph), H + ph * 0.12, Math.sin(a) * 0.016 * (1 + ph));
      m.rotation.y = t * 3 + j;
      m.material.opacity = gk * (1 - ph);
    });
    // 5) Icon steigt aus der Truhe, schwebt pulsierend darüber, schaut beim Erscheinen zur Kamera und pendelt dann ±25°
    if (u.icon) {
      const { g: ig, spin, halo } = u.icon, k = clamp01((t - 1.6) / 0.8);
      ig.visible = k > 0;
      if (ig.visible) {
        const top = g.position.y + s.position.y + H;
        ig.position.set(g.position.x, top + 0.01 + 0.075 * easeOutBack(k) + Math.sin(time * 2) * 0.005 * k, g.position.z);
        ig.scale.setScalar(Math.max(0.001, smooth(k * 1.3) * (1 + 0.07 * Math.sin(time * 4) * k) * out));
        halo.material.opacity = k * (0.4 + 0.2 * Math.sin(time * 4));
        if (!u.icon.aimed && sceneEl.camera) {   // einmal ausrichten (sobald die Pose gültig ist), danach steht es fest im Raum
          sceneEl.camera.getWorldPosition(camPos);
          ig.lookAt(camPos);
          u.icon.aimed = Number.isFinite(ig.quaternion.x);
          if (!u.icon.aimed) ig.quaternion.identity();
        }
        spin.rotation.y = Math.sin(time * 0.9) * 0.44 * k + (1 - k) * Math.PI * 2;   // beim Aufsteigen eine Drehung
      }
    }
  }
  /** Bildschirm-Rechteck (DOMRect) des Icons, Startpunkt für den Flug der Vollbild-Karte in main.js. */
  function iconRect() {
    const ic = treasure && treasure.u.icon, cam = sceneEl.camera;
    if (!ic || !cam || !sceneEl.canvas) return null;
    const rect = sceneEl.canvas.getBoundingClientRect(), c = new THREE.Vector3(), e = new THREE.Vector3();
    ic.disc.getWorldPosition(c);
    e.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(ICON_R * ic.g.scale.x * ic.g.parent.matrixWorld.getMaxScaleOnAxis()).add(c);
    const px = (v) => { v.project(cam); return [rect.left + (v.x * 0.5 + 0.5) * rect.width, rect.top + (-v.y * 0.5 + 0.5) * rect.height]; };
    const [x, y] = px(c), [x2] = px(e), rr = Math.max(4, Math.abs(x2 - x));
    return Number.isFinite(x + y + rr) ? new DOMRect(x - rr, y - rr, rr * 2, rr * 2) : null;
  }
  function showCard(r, c, { icon, theme } = {}) {
    const u = showTreasure(r, c, { src: icon || (theme ? `assets/ui/icon-${theme}.png` : null), theme });
    return new Promise((res) => { u.resolve = (v) => { u.resolve = () => {}; res(v); }; });
  }

  // --- Bewegung (eigene rAF-Schleife; läuft auch weiter, wenn das Ziel kurz verloren ist) ---
  let curIdx = 0, active = -1, reached = -1, move = null, cheerT = 0, litColor = null, time = 0, last = performance.now(), raf = 0;
  const pos = U(...ROUTE[0]);
  const headTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  let heading = headTo(pos, U(...ROUTE[1])), want = heading;
  const camLocal = new THREE.Vector3();
  /** Kameraposition in `up`-Koordinaten (null, solange das Ziel unsichtbar/entartet ist). */
  function camInUp() {
    const cam = sceneEl.camera;
    if (!cam) return null;
    cam.getWorldPosition(camLocal);
    up.updateWorldMatrix(true, false);
    up.worldToLocal(camLocal);
    return Number.isFinite(camLocal.x) && Number.isFinite(camLocal.z) ? camLocal : null;
  }
  function faceCamera() {
    const c = camInUp();
    if (c) want = headTo(pos, c);
  }
  function moveAlong(pts, step) {
    if (move) move.done();
    if (!pts.length) return Promise.resolve();
    setAnim('walk');
    return new Promise((res) => {
      // Sicherheitsnetz: im Hintergrund/bei Bildschirmsperre läuft rAF nicht – spätestens nach Dauer + 2 s ist der Weg fertig
      const tm = setTimeout(finishMove, (pts.length * step + 2) * 1000);
      move = { pts, k: 0, t: 0, step, from: pos.clone(), done: () => { clearTimeout(tm); move = null; setAnim('idle'); res(); } };
    });
  }
  function finishMove() {
    if (!move) return;
    pos.copy(move.pts[move.pts.length - 1]);
    move.done();
    faceCamera();
  }
  const onHide = () => document.hidden && finishMove();
  document.addEventListener('visibilitychange', onHide);
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now; time += dt;
    if (move) {
      move.t += dt;
      const to = move.pts[move.k];
      pos.lerpVectors(move.from, to, clamp01(move.t / move.step));
      if (move.from.distanceToSquared(to) > 1e-10) want = headTo(move.from, to);
      if (move.t >= move.step) {
        move.from = to.clone(); move.t -= move.step; move.k++;
        if (move.k >= move.pts.length) { move.done(); faceCamera(); }
      }
    }
    heading += angleDiff(want, heading) * Math.min(1, dt * 10);
    holder.position.copy(pos);
    holder.rotation.y = heading;
    star.visible = debug || reached >= 4;
    star.rotation.y = time * 1.2;
    star.position.y = U(4, 4).y + 0.17 + Math.sin(time * 2) * 0.008;
    rings.forEach((m, k) => {
      m.visible = debug || k <= reached;
      m.material.opacity = k === active ? 0.55 + 0.35 * Math.sin(time * 5) : 0.25;
    });
    for (const d of dots) {
      d.lit.visible = d.color === litColor;
      if (d.lit.visible) d.lit.scale.setScalar(1 + 0.22 * (0.5 + 0.5 * Math.sin(time * 6)));
    }
    if (treasure) animTreasure();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // --- Antippen der Farbpunkte (eigener Raycast auf die unsichtbaren Kreisflächen) ---
  let tapCb = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const onTap = (e) => {
    if (!sceneEl.camera) return;
    const rect = sceneEl.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, sceneEl.camera);
    const u = treasure && treasure.u;
    if (u && u.icon && u.hideT == null) {   // Icon antippen; nach 1,5 s zählt jeder Tipp ins Kamerabild
      if (time - u.t0 > 1.5 || (isTracking() && u.icon.g.visible && ray.intersectObject(u.icon.hit, false).length)) u.resolve(iconRect());
      return;
    }
    if (!tapCb || !isTracking()) return;
    const hit = ray.intersectObjects(dots.map((d) => d.hit), false)[0];
    if (hit) tapCb(hit.object.userData.color);
  };
  sceneEl.canvas.addEventListener('click', onTap);

  return {
    isAr: true,
    walkTo(i, { instant = false } = {}) {
      hideCard(true);
      active = -1;
      const arrive = () => { reached = i; active = i < 4 ? i : -1; };   // Feld wird erst bei Ankunft sichtbar
      const t = stops[i];
      if (t < 0) { pos.copy(U(...STOPS[i])); arrive(); return Promise.resolve(); }   // Station nicht auf ROUTE
      if (instant || t === curIdx) {
        if (move) move.done();
        curIdx = t;
        pos.copy(U(...ROUTE[t]));
        faceCamera();
        heading = want;
        arrive();
        return Promise.resolve();
      }
      const path = curIdx < t ? ROUTE.slice(curIdx + 1, t + 1) : ROUTE.slice(t, curIdx).reverse();
      curIdx = t;
      return moveAlong(path.map((p) => U(...p)), STEP_S).then(() => curIdx === t && arrive());   // unterbrochen: nichts aufdecken
    },
    cheer() {
      setAnim('cheer');
      faceCamera();
      clearTimeout(cheerT);
      cheerT = setTimeout(() => !move && setAnim('idle'), 1900);
    },
    showChest(r, c) { showTreasure(r, c, null); },   // alte Variante: nur Truhe, kein Icon
    hideChest,
    /** „Nochmals spielen“: alles wieder geheim, Paar sofort auf Start (7,7). Kamera/MindAR laufen weiter. */
    reset() {
      if (move) move.done();
      clearTimeout(cheerT);
      hideCard(true);
      curIdx = 0; reached = -1; active = -1; litColor = null;
      pos.copy(U(...ROUTE[0]));
      heading = want = headTo(pos, U(...ROUTE[1]));
      setAnim('idle');
    },
    showCard,
    hideCard: () => hideCard(),
    highlightDot(color) { litColor = color ? GERMAN[color] || color : null; },
    onDotTap(cb) { tapCb = cb; },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(cheerT);
      if (move) move.done();
      hideCard(true);
      document.removeEventListener('visibilitychange', onHide);
      sceneEl.canvas && sceneEl.canvas.removeEventListener('click', onTap);
      anchor.remove(root);
      coupleEl.remove();
    },
  };
}

/** Debug: 7x7-Raster, Feldnummern (r,c) und ROUTE-Index als Canvas-Textur exakt über der Plättchenfläche. */
function makeDebugOverlay(THREE, aspect) {
  const a = TARGET_TILE_AREA, N = 1024, cs = N / 7;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const mid = (k) => (k - 0.5) * cs;
  g.strokeStyle = 'rgba(255,140,0,.9)'; g.lineWidth = 6; g.beginPath();
  ROUTE.forEach(([r, c], k) => (k ? g.lineTo(mid(c), mid(r)) : g.moveTo(mid(c), mid(r))));
  g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  for (let k = 0; k <= 7; k++) {
    g.beginPath(); g.moveTo(k * cs, 0); g.lineTo(k * cs, N); g.stroke();
    g.beginPath(); g.moveTo(0, k * cs); g.lineTo(N, k * cs); g.stroke();
  }
  g.font = 'bold 26px system-ui, sans-serif'; g.lineWidth = 5; g.strokeStyle = '#000'; g.fillStyle = '#fff';
  const idx = {};
  ROUTE.forEach(([r, c], k) => ((idx[r + ',' + c] ||= []).push(k)));
  for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) {
    const t1 = `${r},${c}`, t2 = idx[t1] ? '#' + idx[t1].join('/') : '';
    for (const [t, y] of [[t1, 30], [t2, cs - 12]]) { g.strokeText(t, (c - 1) * cs + 8, (r - 1) * cs + y); g.fillText(t, (c - 1) * cs + 8, (r - 1) * cs + y); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = a.x1 - a.x0, h = (a.y1 - a.y0) * aspect;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.set((a.x0 + a.x1) / 2 - 0.5, (0.5 - (a.y0 + a.y1) / 2) * aspect, 0.002);
  return m;
}

const STYLE = `
.ar-host{position:relative;overflow:hidden;isolation:isolate;background:#000}
.ar-host>a-scene{position:absolute;inset:0;width:100%;height:100%}
.ar-scan{position:absolute;inset:0;z-index:3;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;transition:opacity .3s}
.ar-scan[hidden]{display:flex;opacity:0}
.ar-scan .ar-frame{width:min(68vw,52vh);aspect-ratio:1;border:3px dashed rgba(245,197,66,.9);border-radius:18px;box-shadow:0 0 0 2000px rgba(0,0,0,.25);animation:ar-pulse 1.6s ease-in-out infinite}
.ar-scan[hidden] .ar-frame{animation:none}
.ar-scan .ar-msg{max-width:84%;padding:10px 16px;border-radius:14px;background:rgba(5,11,46,.88);border:1px solid #f5c542;color:#fff8e7;font:600 16px/1.35 system-ui,sans-serif;text-align:center}
.ar-scan .ar-msg small{display:block;font-weight:400;font-size:13px;opacity:.9;margin-top:4px}
.ar-scan.lost .ar-frame{display:none}
.ar-scan.lost{justify-content:flex-start;padding-top:calc(env(safe-area-inset-top) + 64px)}
.ar-rot{position:fixed;inset:0;z-index:25;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(5,11,46,.94);color:#fff8e7;font:600 20px/1.4 system-ui,sans-serif;text-align:center}
@media (orientation:landscape) and (max-height:500px){.ar-rot{display:flex}}
@keyframes ar-pulse{50%{transform:scale(.97);opacity:.75}}
@media (prefers-reduced-motion:reduce){.ar-scan .ar-frame{animation:none}}`;

/**
 * Startet Kamera + MindAR in `container`. Wirft benannte Fehler (main.js → Fallback mit passendem Toast):
 * NotAllowedError/NotFoundError/… (Kamera), CdnError (Skripte), TargetError (targets.mind), ArError, Cancelled.
 * onPhase('loading'|'permission'|'starting'|'ready'): Fortschritt, damit main.js die Zeit im Kamera-Dialog nicht mitzählt.
 * onFatal(err): Kamera nach dem Start endgültig weg (Neustart gescheitert) → main.js wechselt in den Fallback.
 */
export async function createArStage(container, { onPhase = () => {}, onFatal = () => {} } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw named('NotSupportedError', 'Kamera-API nicht verfügbar');
  const q = new URLSearchParams(location.search);
  const debug = q.get('debug') === '1';
  const targetSrc = (debug && q.get('target')) || 'targets.mind';             // ?debug=1&target=… nur zum Testen (z. B. 404)
  // One-Euro-Filter von MindAR (Zeit in ms!): pro Matrixelement Grenzfrequenz = mincf + beta·|Ableitung|, in kHz.
  // mincf 0.005 = 5 Hz ≙ Zeitkonstante 32 ms; beta 0 = gleiche Glättung für Drehung und Verschiebung (sonst zittert die Ecke stärker).
  // Früher 0.0001/0.001 = 0,1 Hz ≙ 1,6 s Zeitkonstante → Einblendung schwamm hinterher. Messung und Test-URLs: docs/AR.md.
  const num = (k, d) => (q.has(k) && Number.isFinite(+q.get(k)) ? +q.get(k) : d);
  const minCF = num('mincf', 0.005), beta = num('beta', 0);

  // Bildschirm wach halten (Auto-Sperre). Gleich hier, so nah wie möglich an der Start-Geste.
  let destroyed = false, wl = null, wlBusy = false;
  const lockScreen = () => {
    if (destroyed || wlBusy || document.hidden || (wl && !wl.released) || !navigator.wakeLock) return;
    wlBusy = true;
    navigator.wakeLock.request('screen').then((l) => { if (destroyed) l.release(); else wl = l; }, () => {}).finally(() => (wlBusy = false));
  };
  lockScreen();
  const bail = (e) => { destroyed = true; if (wl) wl.release().catch(() => {}); throw e; };   // Fehler vor dem Szenenaufbau

  onPhase('loading');
  // Erst alles laden, was ohne Kamera geht. Danach genau EIN getUserMedia, dessen Stream MindAR direkt übernimmt
  // (kein zweiter Kamera-Dialog auf iOS, keine Lücke, echte Fehlernamen statt MindARs „VIDEO_FAIL“).
  const [aspect] = await Promise.all([
    new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i.naturalHeight / i.naturalWidth || 1);
      i.onerror = () => res(1);
      i.src = 'assets/target.jpg';
    }),
    (async () => {
      if (!window.AFRAME) await loadScript(AFRAME_SRC);
      if (!window.AFRAME.components['mindar-image']) await loadScript(MINDAR_SRC);
    })(),
    checkTargets(targetSrc),
  ]).catch(bail);
  if (!container.isConnected) bail(named('Cancelled', 'abgebrochen'));
  onPhase('permission');
  let cam = await gum().catch(bail);
  if (!container.isConnected) { cam.getTracks().forEach((t) => t.stop()); bail(named('Cancelled', 'abgebrochen')); }
  onPhase('starting');

  if (!document.getElementById('ar-style')) {
    const st = document.createElement('style');
    st.id = 'ar-style'; st.textContent = STYLE;
    document.head.append(st);
  }
  container.innerHTML = '';
  container.classList.add('ar-host');
  container.insertAdjacentHTML('beforeend', `
<a-scene embedded light="defaultLightsEnabled: false" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
  renderer="antialias: true; alpha: true"
  mindar-image="imageTargetSrc: ${targetSrc}; maxTrack: 1; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: ${minCF}; filterBeta: ${beta}; missTolerance: 10; warmupTolerance: 4">
  <a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
  <a-entity id="ar-target" mindar-image-target="targetIndex: 0"></a-entity>
</a-scene>
<div class="ar-scan" role="status" aria-live="polite"><div class="ar-frame"></div>
  <p class="ar-msg">Haltet die Kamera ruhig auf das Spielbrett<small>Am besten von oben, bei gutem Licht</small></p></div>`);
  const sceneEl = container.querySelector('a-scene');
  const targetEl = container.querySelector('#ar-target');
  const scan = container.querySelector('.ar-scan');
  const msg = scan.querySelector('.ar-msg');
  const rot = Object.assign(document.createElement('div'), { className: 'ar-rot', textContent: '📱 Bitte im Hochformat spielen' });
  document.body.append(rot);   // ausserhalb des Hosts: muss auch über dem Quiz-Panel liegen

  let tracking = false, stage = null, iv = 0, live = false, restarting = false, fatalSent = false, visT = 0, rotT = 0;
  // Gleich anhängen: ein früher targetFound (vor dem Ende von buildBoard) darf nicht verloren gehen
  targetEl.addEventListener('targetFound', () => { tracking = true; scan.hidden = true; });
  const showLost = () => {
    scan.classList.add('lost');
    msg.innerHTML = 'Brett aus dem Blick – haltet die Kamera wieder aufs Brett<small>Das Spiel läuft weiter.</small>';
    scan.hidden = false;
  };
  targetEl.addEventListener('targetLost', () => { tracking = false; showLost(); });

  const sys = () => (sceneEl.systems && sceneEl.systems['mindar-image-system']) || {};
  const stopCam = () => {
    const v = sys().video;
    for (const s of [cam, v && v.srcObject]) if (s) s.getTracks().forEach((t) => t.stop());
  };
  const camDead = () => {
    const v = sys().video, s = v && v.srcObject;
    return !s || s.getVideoTracks().some((t) => t.readyState === 'ended');
  };
  const fatal = (e) => {
    if (destroyed || fatalSent) return;
    fatalSent = true;
    console.warn('AR-Kamera ausgefallen:', e);
    onFatal(e);
  };
  const onEnded = () => { if (live && !document.hidden) restartCam(); };   // versteckt: übernimmt onVis

  // MindAR 1.2.5 anpassen (nur dieses System-Objekt): eigener Stream statt eigenem getUserMedia, robustes stop(),
  // kein Start/keine Schleife mehr nach destroy, resize-Handler nach destroy wirkungslos.
  const S = sys();
  if (S._startAR && S._startVideo) {
    const start0 = S._startAR, resize0 = S._resize;
    S._startVideo = function () {
      const v = (this.video = document.createElement('video'));
      for (const a of ['autoplay', 'muted', 'playsinline']) v.setAttribute(a, '');
      v.muted = true;
      v.style.cssText = 'position:absolute;top:0;left:0;z-index:-2';
      this.container.appendChild(v);
      v.addEventListener('loadedmetadata', () => {
        v.setAttribute('width', v.videoWidth);
        v.setAttribute('height', v.videoHeight);
        this._startAR();
      }, { once: true });
      v.srcObject = cam;
      cam.getVideoTracks().forEach((t) => t.addEventListener('ended', onEnded));
    };
    S.stop = function () {
      const c = this.controller, v = this.video;
      this.controller = null;
      if (c) { c.stopProcessVideo(); try { c.dispose(); } catch { /* Worker schon weg */ } }
      stopCam();
      if (v) { v.pause(); v.srcObject = null; v.remove(); }
    };
    S._startAR = function () {
      if (destroyed || !sceneEl.isConnected) return stopCam();
      // destroy während des Starts: nach dem Start sofort wieder stoppen, damit keine TF.js-Schleife weiterläuft
      return start0.call(this).then(() => { if (destroyed || !sceneEl.isConnected) this.stop(); }, (e) => {
        if (destroyed || !sceneEl.isConnected) return;   // abgebrochen: stop() hat den Controller schon entsorgt
        console.warn('MindAR-Start fehlgeschlagen:', e);
        this.el.emit('arError', { error: String(e && e.message || e) });
      });
    };
    // ponytail: jeder (Neu-)Start hängt einen weiteren gebundenen resize-Listener an (MindAR entfernt ihn nie); dank Guard harmlos
    S._resize = function () {
      if (destroyed || !this.controller || !this.video || !this.container || !this.container.isConnected) return;
      resize0.call(this);
    };
  }

  /** Kamera neu starten (Track beendet, Video-Masse geändert). Spielzustand bleibt; scheitert es → onFatal. */
  async function restartCam() {
    if (destroyed || restarting || !live || document.hidden) return;
    restarting = true;
    const tc = targetEl.components['mindar-image-target'];
    if (targetEl.object3D.visible && tc) tc.updateWorldMatrix(null);   // altes Bild nicht stehen lassen
    scan.classList.remove('lost');
    msg.innerHTML = 'Kamera startet neu …<small>Haltet die Kamera aufs Brett</small>';
    scan.hidden = false;
    try {
      sys().stop();
      cam = await gum();
      if (destroyed) return stopCam();
      await new Promise((res, rej) => {
        const done = (err) => {
          clearTimeout(t);
          sceneEl.removeEventListener('arReady', ok);
          sceneEl.removeEventListener('arError', bad);
          err ? rej(err) : res();
        };
        const ok = () => done(), bad = (e) => done(named('ArError', 'MindAR: ' + (e.detail && e.detail.error)));
        const t = setTimeout(() => done(named('Timeout', 'Kamera-Neustart dauert zu lange')), 20000);
        sceneEl.addEventListener('arReady', ok);
        sceneEl.addEventListener('arError', bad);
        sys().start();
      });
      if (!tracking) showLost();
    } catch (e) {
      fatal(e);
    } finally {
      restarting = false;
    }
  }

  // Zurück aus Hintergrund/Sperre: Wake Lock neu, Video weiterspielen, tote/stumme Kamera neu starten
  const onVis = () => {
    if (document.hidden || destroyed) return;
    lockScreen();
    if (!live) return;
    if (camDead()) return restartCam();
    const v = sys().video;
    v.play().catch(() => {});
    clearTimeout(visT);
    visT = setTimeout(() => {
      const w = sys().video, s = w && w.srcObject;
      if (camDead() || w.paused || (s && s.getVideoTracks().some((t) => t.muted))) restartCam();
    }, 2500);
  };
  // Zurück ins Hochformat: haben sich die Videomasse geändert, passt MindARs Eingabegrösse nicht mehr → Neustart
  const portrait = matchMedia('(orientation: portrait)');
  const onOrient = () => {
    clearTimeout(rotT);
    if (!portrait.matches || !live) return;
    rotT = setTimeout(() => {   // iOS meldet die neuen Masse erst etwas später
      const v = sys().video, c = sys().controller;
      if (v && c && (v.videoWidth !== c.inputWidth || v.videoHeight !== c.inputHeight)) restartCam();
    }, 800);
  };
  document.addEventListener('visibilitychange', onVis);
  document.addEventListener('pointerdown', lockScreen, true);   // falls der erste Wake-Lock-Versuch eine Geste brauchte
  portrait.addEventListener('change', onOrient);

  // Mehrfach aufrufbar; räumt nur innerhalb von `container` auf. Auch wenn MindAR noch startet.
  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    clearInterval(iv); clearTimeout(visT); clearTimeout(rotT);
    document.removeEventListener('visibilitychange', onVis);
    document.removeEventListener('pointerdown', lockScreen, true);
    portrait.removeEventListener('change', onOrient);
    if (wl) wl.release().catch(() => {});
    if (sys().stop) sys().stop();
    stopCam();
    if (stage) stage.destroy();
    const r = sceneEl.renderer;
    container.innerHTML = '';
    container.classList.remove('ar-host');
    rot.remove();
    if (r) { r.dispose(); r.forceContextLoss(); }   // WebGL-Kontext sofort freigeben (iOS hat nur wenige)
  };

  const ready = new Promise((res, rej) => {
    sceneEl.addEventListener('arReady', res, { once: true });
    sceneEl.addEventListener('arError', (e) => rej(named('ArError', 'MindAR: ' + (e.detail && e.detail.error))), { once: true });
    setTimeout(() => rej(named('Timeout', 'MindAR-Start dauert zu lange')), 45000);
    // main.js entfernt den Host bei Abbruch/Timeout: dann sofort aufräumen, damit die Kamera nicht weiterläuft
    iv = setInterval(() => { if (!container.isConnected) rej(named('Cancelled', 'abgebrochen')); }, 300);
  });
  ready.catch(() => {});
  try {
    const guard = (p) => Promise.race([p, ready.then(() => p)]);   // bricht ab, sobald `ready` scheitert
    if (!sceneEl.hasLoaded) await guard(once(sceneEl, 'loaded'));
    // iPhone hat 3: 1.5 reicht für die kleinen Low-Poly-Figuren und lässt der Bilderkennung (TF.js, gleiche GPU) mehr Luft
    if (sceneEl.renderer) sceneEl.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    const board = buildBoard({ sceneEl, anchor: targetEl.object3D, aspect, debug, isTracking: () => tracking });
    board.then((s) => destroyed && s.destroy(), () => {});          // zu spät fertig: gleich wieder weg
    stage = await guard(board);
    await ready;
    clearInterval(iv);
  } catch (e) {
    cleanup();
    throw e;
  }
  if (debug) {   // Messwerte fürs Tuning am iPhone: Video-Auflösung, Pose-Updates/s (MindAR), Bilder/s (Render)
    const hud = Object.assign(document.createElement('div'), { className: 'ar-hud' });
    hud.style.cssText = 'position:absolute;left:6px;bottom:6px;z-index:4;pointer-events:none;padding:3px 6px;border-radius:6px;background:rgba(0,0,0,.55);color:#fff;font:11px/1.3 ui-monospace,monospace';
    container.append(hud);
    let nUpd = 0, nFr = 0, t = performance.now();
    targetEl.addEventListener('targetUpdate', () => nUpd++);
    (function count(now) {
      if (destroyed) return;
      nFr++;
      if (now - t > 1000) {
        const v = sys().video, k = 1000 / (now - t);
        hud.textContent = `Video ${v ? v.videoWidth + '×' + v.videoHeight : '?'} · Tracking ${Math.round(nUpd * k)}/s · Bild ${Math.round(nFr * k)}/s · mincf ${minCF} beta ${beta}`;
        nUpd = nFr = 0; t = now;
      }
      requestAnimationFrame(count);
    })(t);
  }
  tracking = targetEl.object3D.visible;
  live = true;
  onPhase('ready');
  return { ...stage, destroy: cleanup };
}
