// AR-Bühne: MindAR 1.2.5 (Image Tracking) + A-Frame 1.5.0, Stage-Schnittstelle wie fallback.js / docs/ARCHITEKTUR.md:
//   walkTo(i, {instant}) → Promise   i: 0..3 = Station 1..4, 4 = Ziel; instant = direkt hinsetzen (Reload)
//   cheer(), showChest(r, c), hideChest(), highlightDot('red'|'green'|'yellow'|'blue'|null), onDotTap(cb(color)), destroy()
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

const loadScript = (src) => new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = src; s.onload = res;
  s.onerror = () => rej(new Error('Skript nicht ladbar: ' + src));
  document.head.append(s);
});
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
    const hit = new THREE.Mesh(new THREE.CircleGeometry(cell * 0.45, 24), new THREE.MeshBasicMaterial({ visible: false }));
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

  // --- Truhe ---
  let chest = null;
  function makeChest() {
    const W = 0.075, D = 0.052, H = 0.04, R = D / 2;
    const g = new THREE.Group(), s = new THREE.Group();
    g.add(s);
    const wood = std(0x8a4b12), gold = std(0xf5c542, { metalness: 0.6, roughness: 0.35, emissive: 0x5a3c00 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wood);
    base.position.y = H / 2;
    const coins = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.006, D * 0.85), std(0xffd54a, { emissive: 0xffb300, emissiveIntensity: 0.8, metalness: 0.5 }));
    coins.position.y = H - 0.002;
    s.add(base, coins);
    const lid = new THREE.Group();
    lid.position.set(0, H, -R);                      // Scharnier hinten oben
    const lg = new THREE.CylinderGeometry(R, R, W, 8, 1, false, 0, Math.PI);
    lg.rotateZ(Math.PI / 2);                           // Halbzylinder, Achse entlang x, Wölbung nach oben
    const lm = new THREE.Mesh(lg, std(0xa85e17, { side: THREE.DoubleSide }));
    lm.position.z = R;
    lid.add(lm);
    for (const x of [-W * 0.32, W * 0.32]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.008, H + 0.002, D + 0.002), gold);
      band.position.set(x, H / 2, 0);
      const lb = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.001, R + 0.001, 0.008, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), gold);
      lb.position.set(x, 0, R);
      s.add(band); lid.add(lb);
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.004), gold);
    lock.position.set(0, H - 0.006, D / 2 + 0.002);
    s.add(lid, lock);
    // Goldglanz: additives Leuchten + aufsteigende Funken
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cg = cv.getContext('2d'), grad = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,240,170,1)'); grad.addColorStop(0.4, 'rgba(255,200,60,.55)'); grad.addColorStop(1, 'rgba(255,180,0,0)');
    cg.fillStyle = grad; cg.fillRect(0, 0, 64, 64);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.position.y = H + 0.015;
    s.add(glow);
    const sparks = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.0055), basic(0xffe27a, { opacity: 0 }));
      s.add(m);
      return m;
    });
    Object.assign(g.userData, { s, lid, glow, sparks, H, t0: time });
    return g;
  }
  function animChest() {
    const { s, lid, glow, sparks, H, t0 } = chest.userData, t = time - t0;
    s.scale.setScalar(Math.max(0.001, easeOutBack(clamp01(t / 0.45))));
    s.position.y = Math.max(0, Math.sin(clamp01(t / 0.6) * Math.PI)) * 0.06;   // springt aus dem Feld
    lid.rotation.x = -1.95 * smooth((t - 0.6) / 0.5);                          // Deckel öffnet nach hinten
    const gk = smooth((t - 0.85) / 0.4), pulse = Math.sin(t * 6);
    glow.material.opacity = gk * (0.8 + 0.2 * pulse);
    glow.scale.setScalar(0.03 + 0.11 * gk * (1 + 0.08 * pulse));
    sparks.forEach((m, j) => {
      const ph = (t * 0.6 + j / sparks.length) % 1, a = j * 2.4;
      m.position.set(Math.cos(a) * 0.018 * (1 + ph), H + ph * 0.11, Math.sin(a) * 0.014 * (1 + ph));
      m.rotation.y = t * 3 + j;
      m.material.opacity = gk * (1 - ph);
    });
  }
  const hideChest = () => { if (chest) { up.remove(chest); chest = null; } };

  // --- Bewegung (eigene rAF-Schleife; läuft auch weiter, wenn das Ziel kurz verloren ist) ---
  let curIdx = 0, active = -1, move = null, cheerT = 0, litColor = null, time = 0, last = performance.now(), raf = 0;
  const pos = U(...ROUTE[0]);
  const headTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  let heading = headTo(pos, U(...ROUTE[1])), want = heading;
  const camLocal = new THREE.Vector3();
  function faceCamera() {
    const cam = sceneEl.camera;
    if (!cam) return;
    cam.getWorldPosition(camLocal);
    up.updateWorldMatrix(true, false);
    up.worldToLocal(camLocal);
    if (Number.isFinite(camLocal.x) && Number.isFinite(camLocal.z)) want = headTo(pos, camLocal);
  }
  function moveAlong(pts, step) {
    if (move) move.done();
    if (!pts.length) return Promise.resolve();
    setAnim('walk');
    return new Promise((res) => {
      move = { pts, k: 0, t: 0, step, from: pos.clone(), done: () => { move = null; setAnim('idle'); res(); } };
    });
  }
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
    star.rotation.y = time * 1.2;
    star.position.y = U(4, 4).y + 0.17 + Math.sin(time * 2) * 0.008;
    rings.forEach((m, k) => (m.material.opacity = k === active ? 0.55 + 0.35 * Math.sin(time * 5) : 0.4));
    for (const d of dots) {
      d.lit.visible = d.color === litColor;
      if (d.lit.visible) d.lit.scale.setScalar(1 + 0.22 * (0.5 + 0.5 * Math.sin(time * 6)));
    }
    if (chest) animChest();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // --- Antippen der Farbpunkte (eigener Raycast auf die unsichtbaren Kreisflächen) ---
  let tapCb = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const onTap = (e) => {
    if (!tapCb || !isTracking() || !sceneEl.camera) return;
    const rect = sceneEl.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, sceneEl.camera);
    const hit = ray.intersectObjects(dots.map((d) => d.hit), false)[0];
    if (hit) tapCb(hit.object.userData.color);
  };
  sceneEl.canvas.addEventListener('click', onTap);

  return {
    isAr: true,
    walkTo(i, { instant = false } = {}) {
      hideChest();
      active = i < 4 ? i : -1;
      const t = stops[i];
      if (t < 0) { pos.copy(U(...STOPS[i])); return Promise.resolve(); }   // Station nicht auf ROUTE
      if (instant || t === curIdx) {
        if (move) move.done();
        curIdx = t;
        pos.copy(U(...ROUTE[t]));
        faceCamera();
        heading = want;
        return Promise.resolve();
      }
      const path = curIdx < t ? ROUTE.slice(curIdx + 1, t + 1) : ROUTE.slice(t, curIdx).reverse();
      curIdx = t;
      return moveAlong(path.map((p) => U(...p)), STEP_S);
    },
    cheer() {
      setAnim('cheer');
      faceCamera();
      clearTimeout(cheerT);
      cheerT = setTimeout(() => !move && setAnim('idle'), 1900);
    },
    showChest(r, c) {
      hideChest();
      const cp = U(r, c);
      chest = makeChest();
      chest.position.copy(cp);
      up.add(chest);
      // Paar tritt einen halben Schritt Richtung Brettmitte (am Ziel: Richtung Reihe 7) und schaut zur Truhe
      const d = U(4, 4).sub(cp).setY(0);
      if (d.lengthSq() < 1e-8) d.set(0, 0, 1);
      const side = cp.clone().add(d.normalize().multiplyScalar(cell * 0.6));
      side.y = r === 4 && c === 4 ? 0 : cp.y;
      moveAlong([side], 0.4).then(() => { if (!move) want = headTo(pos, cp); });
    },
    hideChest,
    highlightDot(color) { litColor = color ? GERMAN[color] || color : null; },
    onDotTap(cb) { tapCb = cb; },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(cheerT);
      if (move) move.done();
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
.ar-scan .ar-msg{max-width:84%;padding:10px 16px;border-radius:14px;background:rgba(5,11,46,.88);border:1px solid #f5c542;color:#fff8e7;font:600 16px/1.35 system-ui,sans-serif;text-align:center}
.ar-scan .ar-msg small{display:block;font-weight:400;font-size:13px;opacity:.9;margin-top:4px}
.ar-scan.lost .ar-frame{display:none}
.ar-scan.lost{justify-content:flex-start;padding-top:calc(env(safe-area-inset-top) + 64px)}
@keyframes ar-pulse{50%{transform:scale(.97);opacity:.75}}
@media (prefers-reduced-motion:reduce){.ar-scan .ar-frame{animation:none}}`;

/** Startet Kamera + MindAR in `container`. Wirft bei verweigerter/fehlender Kamera (main.js → Fallback). */
export async function createArStage(container) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw Object.assign(new Error('Kamera-API nicht verfügbar'), { name: 'NotSupportedError' });
  }
  // Zuerst selbst nach der Kamera fragen: MindAR verschluckt den Fehlernamen (NotAllowedError) sonst.
  const probe = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
  probe.getTracks().forEach((t) => t.stop());

  if (!window.AFRAME) await loadScript(AFRAME_SRC);
  if (!window.AFRAME.components['mindar-image']) await loadScript(MINDAR_SRC);

  const q = new URLSearchParams(location.search);
  const debug = q.get('debug') === '1';
  const minCF = +(q.get('mincf') || 0.0001), beta = +(q.get('beta') || 0.001);   // Glättung, am Brett tunebar
  const aspect = await new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i.naturalHeight / i.naturalWidth || 1);
    i.onerror = () => res(1);
    i.src = 'assets/target.jpg';
  });

  if (!document.getElementById('ar-style')) {
    const st = document.createElement('style');
    st.id = 'ar-style'; st.textContent = STYLE;
    document.head.append(st);
  }
  container.innerHTML = '';
  container.classList.add('ar-host');
  container.insertAdjacentHTML('beforeend', `
<a-scene embedded light="defaultLightsEnabled: false" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
  renderer="antialias: true; alpha: true; colorManagement: true"
  mindar-image="imageTargetSrc: targets.mind; maxTrack: 1; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: ${minCF}; filterBeta: ${beta}; missTolerance: 10; warmupTolerance: 4">
  <a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
  <a-entity id="ar-target" mindar-image-target="targetIndex: 0"></a-entity>
</a-scene>
<div class="ar-scan" role="status" aria-live="polite"><div class="ar-frame"></div>
  <p class="ar-msg">Haltet die Kamera aufs Brett<small>Brett so drehen, dass Rot oben links liegt</small></p></div>`);
  const sceneEl = container.querySelector('a-scene');
  const targetEl = container.querySelector('#ar-target');
  const scan = container.querySelector('.ar-scan');
  const msg = scan.querySelector('.ar-msg');

  let tracking = false, stage = null;
  const cleanup = () => {
    try { sceneEl.systems['mindar-image-system'].stop(); } catch { /* noch nicht gestartet */ }
    stage && stage.destroy();
    container.innerHTML = '';
    container.classList.remove('ar-host');
  };

  const ready = new Promise((res, rej) => {
    sceneEl.addEventListener('arReady', res, { once: true });
    sceneEl.addEventListener('arError', (e) => rej(Object.assign(new Error('MindAR: ' + (e.detail && e.detail.error)), { name: 'ArError' })), { once: true });
    setTimeout(() => rej(new Error('MindAR-Start dauert zu lange')), 45000);
  });
  try {
    if (!sceneEl.hasLoaded) await once(sceneEl, 'loaded');
    stage = await buildBoard({ sceneEl, anchor: targetEl.object3D, aspect, debug, isTracking: () => tracking });
    await ready;
  } catch (e) {
    cleanup();
    throw e;
  }

  targetEl.addEventListener('targetFound', () => { tracking = true; scan.hidden = true; });
  targetEl.addEventListener('targetLost', () => {
    tracking = false;
    scan.classList.add('lost');
    msg.innerHTML = 'Brett aus dem Blick – haltet die Kamera wieder aufs Brett<small>Das Spiel läuft weiter.</small>';
    scan.hidden = false;
  });

  return { ...stage, destroy: cleanup };
}
