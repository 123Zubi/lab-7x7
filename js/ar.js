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
const STEP_S = 0.86;       // Sekunden pro Feld (0,7x Tempo, damit man zusehen kann)
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
/** Kamera-Stream. res = kurze Bildseite als Wunsch (720 → 1280×720, 1080 → 1920×1080), 0 = Browser-Vorgabe (iOS vermutlich 640×480). */
const gum = (res = 0) => navigator.mediaDevices.getUserMedia({
  audio: false,
  video: res > 0 ? { facingMode: 'environment', width: { ideal: Math.round((res * 16) / 9) }, height: { ideal: res } } : { facingMode: 'environment' },
});

/**
 * Eigene Glättung einer Pose (One-Euro-Filter nach Casiez 2012, Zeit in SEKUNDEN). Position und Drehung bekommen dasselbe
 * Gewicht pro Schritt (Slerp für die Drehung), weil ihr Rauschen gekoppelt ist (siehe docs/AR.md „Tracking-Latenz“).
 * Grenzfrequenz = minCF + beta·Geschwindigkeit (rad/s). Geschwindigkeit = max(Verschiebung quer zur Blickrichtung / Entfernung,
 * Drehung um die Blickachse), je als Vektor mit dCF geglättet (Rauschen mittelt sich weg, echte Bewegung nicht). Tiefe und
 * Kippen zählen bewusst nicht: dort rauscht MindAR am stärksten, sie würden die Glättung im Stand sonst aushebeln (gemessen).
 * Stillstand → minCF (stark geglättet), Schwenken → hohe Grenzfrequenz (kaum Verzug). minCF ≤ 0 = Filter aus.
 */
export function makePoseSmoother(THREE, { minCF = 0.5, beta = 40, dCF = 1 } = {}) {
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), dP = new THREE.Vector3(), dR = new THREE.Vector3();
  const vP = new THREE.Vector3(), vR = new THREE.Vector3(), n = new THREE.Vector3(), qd = new THREE.Quaternion(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const alpha = (fc, dt) => 1 / (1 + 1 / (2 * Math.PI * fc * dt));
  let init = false;
  const api = {
    pos: P, quat: Q, fc: 0,
    reset() { init = false; },
    /** Rohwerte p (Vector3) und q (Quaternion, optional), dt in s → geglättet in api.pos / api.quat. */
    filter(pIn, qIn, dt) {
      if (!init || !(dt > 0) || minCF <= 0) {
        P.copy(pIn); if (qIn) Q.copy(qIn);
        vP.set(0, 0, 0); vR.set(0, 0, 0); init = true;
        return api;
      }
      const dist = Math.max(P.length(), 1e-6);
      dP.subVectors(pIn, P).divideScalar(dist * dt);                              // rad/s
      n.copy(P).divideScalar(dist);                                               // Blickrichtung zum Ziel
      dP.addScaledVector(n, -dP.dot(n));                                          // nur quer dazu: die Tiefe rauscht am stärksten
      if (qIn) {                                                                  // Drehvektor (Achse·Winkel) von Q nach qIn, pro s
        qd.copy(Q).invert().premultiply(qIn);
        if (qd.w < 0) qd.set(-qd.x, -qd.y, -qd.z, -qd.w);
        const sn = Math.hypot(qd.x, qd.y, qd.z), ang = 2 * Math.atan2(sn, qd.w);
        dR.set(qd.x, qd.y, qd.z).multiplyScalar(sn > 1e-9 ? ang / sn / dt : 0);
      }
      const ad = alpha(dCF, dt);
      vP.lerp(dP, ad); vR.lerp(dR, ad);
      api.fc = minCF + beta * Math.max(vP.length(), Math.abs(vR.dot(n)));   // Drehung nur um die Blickachse (Kippen rauscht stark)
      const a = alpha(api.fc, dt);
      P.lerp(pIn, a);
      if (qIn) Q.slerp(qIn, a);
      return api;
    },
    /** Matrix-Variante (Skalierung wird roh übernommen, sie ist bei MindAR konstant). */
    filterMatrix(m, dt, out) {
      m.decompose(p, q, s);
      api.filter(p, q.normalize(), dt);   // MindARs Matrix ist nicht exakt orthonormal: |q| ≠ 1 liesse slerp bei < ~4° stehen bleiben
      return out.compose(P, Q, s);
    },
  };
  return api;
}
/**
 * Nahbereich (docs/AR.md „Nah & iPad“). Einmal pro Seite auf MindARs Controller-Klasse (window.MINDAR.IMAGE.Controller):
 * 1. Brennweite: MindAR nimmt fest 45° Bildwinkel über die Video-HÖHE an. Im Hochformat (720×1280) ist das die lange Seite,
 *    echte Handy-/iPad-Kameras haben dort ≈ 60–70°. Die zu lange Brennweite schätzt das Brett zu weit weg und falsch geneigt:
 *    flache Dinge passen trotzdem (Homografie), stehende Figuren werden aber falsch gross/schief, je näher, desto stärker.
 *    Jetzt: tune.fov Grad über die LANGE Seite (Standard 70: iPhone 16 Pro Hauptkamera 24 mm ≈ 72°, iPads ≈ 62–65°), im Hoch- und Querformat gleich. Das Kamerabild-Seitenverhältnis bleibt.
 * 2. Nah-Tracker: MindAR verfolgt immer auf dem 128-px-Abbild des Zielbilds (TRACKING_KEYFRAME = 1) und tastet das Video dafür
 *    mit EINEM Pixel je Abbild-Pixel ab. Ist das Brett im Video viel grösser (nah), ist das stark unterabgetastet (Aliasing),
 *    die Vorlagen passen nicht mehr → Abbruch. Ab tune.near × kurze Videoseite Brettbreite verfolgt ein zweiter Tracker auf dem
 *    256-px-Abbild (liegt schon in targets.mind), darunter der normale (weit weg ist 128 px besser: gemessen).
 *    tune.boardPx: letzte Brettbreite im Video (px) für Haltezeit, tune.tilePx: Breite des verfolgten Ziels (bei Kacheln < Brett).
 * 3. Kacheln (docs/AR.md „Kacheln“): tune.scale[i] = Breite von Ziel i in Brettbreiten (Ganzbrett 1). Die Nah-Stufen richten sich
 *    nach der Breite des verfolgten Ziels (darum geht es beim Aliasing), Haltezeit nach der Brettbreite.
 */
// imgs: Zielbilder je targetIndex (0 ohne, 1 mit Schmuck, wie in targets.mind) für den 512-px-Tracker
const TARGET_IMGS = ['assets/target.jpg', 'assets/target-schmuck.jpg'];
const TILES_SRC = 'assets/target-tiles.json';   // Kachel-Ziele (docs/AR.md „Kacheln“), von tools/make_board_images.py --tiles
const tune = { fov: 70, near: 1, near2: 1.5, boardPx: 0, tilePx: 0, short: 1, imgs: [], scale: [], jump: 0.35, vis: 0.1, edge: 12 };
/** 512-px-Tracking-Abbild aus dem Zielbild (Grauwert wie MindARs Compiler), Punkte vom 256-px-Abbild übernommen (× 2). */
function bigKeyframe(kf, size, im) {
  const f = size / kf.width, w = Math.round(kf.width * f), h = Math.round(kf.height * f);
  const g = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data, data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor((px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3);
  return { data, width: w, height: h, scale: kf.scale * f, points: kf.points.map((p) => ({ ...p, x: p.x * f, y: p.y * f })) };
}
function patchMindar() {
  const C = window.MINDAR && window.MINDAR.IMAGE && window.MINDAR.IMAGE.Controller;
  if (!C || C.prototype.__hlPatched) return;
  C.prototype.__hlPatched = true;
  const add0 = C.prototype.addImageTargetsFromBuffer;
  C.prototype.addImageTargetsFromBuffer = function (buf) {
    const W = this.inputWidth, H = this.inputHeight;
    if (tune.fov > 0) {
      const f = Math.max(W, H) / 2 / Math.tan((tune.fov * Math.PI) / 360);
      this.projectionTransform = [[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]];
      this.projectionMatrix = this._glProjectionMatrix({ projectionTransform: this.projectionTransform, width: W, height: H, near: 10, far: 100000 });
      setTimeout(() => window.dispatchEvent(new Event('resize')));   // MindARs _resize lief schon mit dem alten Bildwinkel
    }
    const res = add0.call(this, buf);
    // MindARs Worker wirft bei manchen entarteten Treffern (gemessen mit 11 Zielen, z. B. Nahaufnahme IMG_6867: „Cannot read
    // properties of null“) und antwortet dann nie: die Such-/Tracking-Schleife wartet ewig, AR steht still. Fehler abfangen und
    // die offene Anfrage als „nichts gefunden“ bzw. „verloren“ beantworten; der Worker selbst läuft weiter.
    this.worker.addEventListener('error', (e) => {
      e.preventDefault();
      if (this.workerMatchDone) this.workerMatchDone({ targetIndex: -1, modelViewTransform: null });
      if (this.workerTrackDone) this.workerTrackDone({ modelViewTransform: null });
    });
    const T = this.tracker, P = this.projectionTransform;
    tune.short = Math.min(W, H);
    const EDGE = tune.edge;   // px Abstand zum Videorand (Suchfenster der Vorlagen ±10 px + halbe Vorlage)
    const tiers = [null, null, null];   // ponytail: Tensoren der Nah-Tracker werden beim Kamera-Neustart nicht freigegeben (wie MindARs eigener Tracker); selten, ein paar MB   // 0: MindARs 128-px-Tracker, 1: 256 px, 2: 512 px (selbst gebaut aus target.jpg)
    let tier = 0;
    const track0 = T.track.bind(T);
    const make = (k) => {   // 512 px nur für Ziele mit Bild (Ganzbrett); Kacheln bleiben dort beim 256er (sie sind selten so gross im Bild)
      const kf = T.trackingDataList.map((d, i) => (k === 1 || !tune.imgs[i] ? d[0] : bigKeyframe(d[0], 512, tune.imgs[i])));
      return new T.constructor(T.markerDimensions, kf.map((d) => [d, d]), P, W, H);
    };
    T.track = (img, mv, idx) => {
      const [mw, mh] = T.markerDimensions[idx];
      const pr = (x, y) => { const Z = mv[2][0] * x + mv[2][1] * y + mv[2][3]; return [(P[0][0] * (mv[0][0] * x + mv[0][1] * y + mv[0][3])) / Z, (P[1][1] * (mv[1][0] * x + mv[1][1] * y + mv[1][3])) / Z]; };
      const a = pr(0, mh / 2), b = pr(mw, mh / 2), px = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (Number.isFinite(px)) { tune.tilePx = px; tune.boardPx = px / (tune.scale[idx] || 1); }
      const k = tune.tilePx / tune.short, lim = [Infinity, tune.near, tune.near2];
      // Hysterese (15 %): kein Hin-und-her an einer Grenze
      while (tier < 2 && lim[tier + 1] > 0 && k > lim[tier + 1]) tier++;
      while (tier > 0 && !(lim[tier] > 0 && k > lim[tier] * 0.85)) tier--;
      if (tier) tiers[tier] ||= make(tier);
      const r = tier ? tiers[tier].track(img, mv, idx) : track0(img, mv, idx);
      // Punkte am oder hinter dem Bildrand verwerfen: dort vergleicht MindAR die Vorlage mit Randpixeln und „findet“ sie trotzdem,
      // die Pose driftet dann (gemessen beim Schwenk nah, Kachel halb aus dem Bild: bis 100 px daneben)
      const keep = r.screenCoords.map((p) => p.x >= EDGE && p.x < W - EDGE && p.y >= EDGE && p.y < H - EDGE);
      if (keep.every(Boolean)) return r;
      return { ...r, worldCoords: r.worldCoords.filter((_, k) => keep[k]), screenCoords: r.screenCoords.filter((_, k) => keep[k]) };
    };
    return res;
  };
  // Kacheln: Verlässt ein Ziel das Bild, liefert MindARs Pose-Verfeinerung mit den letzten paar Punkten manchmal für einige
  // Frames eine völlig falsche Pose (gemessen: Brett 900–1200 px daneben). Darum gilt ein Ziel als verloren, wenn seine Ecken
  // in einem Frame um mehr als tune.jump × Zielbreite springen oder (nur Kacheln) weniger als tune.vis seiner Fläche im Bild
  // liegt. Dann sucht MindAR sofort neu und findet meist die Nachbarkachel; die Einblendung hält solange die letzte gute Pose.
  const tau0 = C.prototype._trackAndUpdate;
  C.prototype._trackAndUpdate = async function (inputT, last, idx) {
    const mv = await tau0.call(this, inputT, last, idx);
    if (!mv) return mv;
    const [w, h] = this.markerDimensions[idx], P = this.projectionTransform, W = this.inputWidth, H = this.inputHeight;
    const pr = (m, x, y) => {
      const Z = m[2][0] * x + m[2][1] * y + m[2][3];
      return [(P[0][0] * (m[0][0] * x + m[0][1] * y + m[0][3])) / Z + P[0][2], (P[1][1] * (m[1][0] * x + m[1][1] * y + m[1][3])) / Z + P[1][2], Z];
    };
    const C4 = [[0, 0], [w, 0], [w, h], [0, h]], a = C4.map(([x, y]) => pr(last, x, y)), b = C4.map(([x, y]) => pr(mv, x, y));
    const size = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
    const jump = Math.max(...a.map((p, k) => Math.hypot(p[0] - b[k][0], p[1] - b[k][1])));
    if (!(jump <= tune.jump * size) || b.some((p) => !(p[2] > 0))) return null;
    if ((tune.scale[idx] || 1) < 1) {
      let inside = 0;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        const [x, y] = pr(mv, ((i + 0.5) / 6) * w, ((j + 0.5) / 6) * h);
        if (x >= 0 && x < W && y >= 0 && y < H) inside++;
      }
      if (inside / 36 < tune.vis) return null;
    }
    return mv;
  };
}

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
export async function buildBoard({ sceneEl, anchor, aspect = 1, debug = false, isTracking = () => true, iconSmooth = {} }) {
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
  // Paar tritt quer zur Blickrichtung zur Seite (auf die Seite der Brettmitte) und schaut aufs Feld (r,c):
  // so steht es neben der Truhe und nicht hinter dem Icon, das über der Truhe schwebt.
  function stepAside(r, c) {
    const cp = U(r, c), toMid = U(4, 4).sub(cp).setY(0), cam = camInUp();
    let d = cam ? new THREE.Vector3(cam.z - cp.z, 0, cp.x - cam.x) : toMid.clone();
    if (d.lengthSq() < 1e-8) d = toMid.clone();
    if (d.lengthSq() < 1e-8) d.set(0, 0, 1);
    if (d.dot(toMid) < 0) d.negate();
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
  // Icon über der offenen Truhe: gross (2,4 Feldbreiten Durchmesser), Mitte 2 Feldbreiten über der Truhe, um 35 % des Wegs
  // zur Brettmitte versetzt (Randfelder: bleibt im Bild und steht nicht über dem Rand). Am iPhone-Bild nachjustierbar.
  // Runde 5: 1,6 statt 2 Feldbreiten hoch (kürzerer Hebelarm: Drehfehler des Trackings bewegen das Icon weniger).
  // Comic-Runde: Durchmesser 2,9 statt 2,4 Feldbreiten, 1,8 hoch (Unterkante bleibt über der Truhe); keepOnScreen hält es im Bild.
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON_R = cell * 1.45, ICON_UP = cell * 1.8, ICON_IN = 0.35, TAP_S = 1.5;
  // Eigene, stärkere Glättung der Icon-Position in Weltkoordinaten (= Kamerakoordinaten, die MindAR-Kamera steht still).
  const iconFilter = makePoseSmoother(THREE, { minCF: 0.4, beta: 25, dCF: 1, ...iconSmooth });
  const vIcon = new THREE.Vector3();
  const texCache = {};
  /** Canvas-Textur, einmal gezeichnet und geteilt (Ring, Hand, Schriftzug). */
  const canvasTex = (key, w, h, draw) => texCache[key] || (texCache[key] = (() => {
    const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
    draw(cv.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })());
  const INK = '#1b1f3b', MUSTARD = '#f2b632', CORAL = '#ef6f5c', TEAL = '#2bb3a6', IVORY = '#fff8e8';
  /** Comic-Burst hinter dem Icon: Zackenstern Senfgelb mit Koralle-Kern und schwarzer Outline (Icon deckt die Mitte bis 0,71 ab). */
  const burst = (g, m, n, r0, r1, rot = 0) => {
    g.beginPath();
    for (let k = 0; k < n * 2; k++) { const a = rot + (k / (n * 2)) * Math.PI * 2, r = k % 2 ? r0 : r1; g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); }
    g.closePath();
  };
  const drawRing = (g, w) => {
    const m = w / 2;
    g.lineJoin = 'round';
    burst(g, m, 16, m * 0.8, m * 0.97); g.fillStyle = MUSTARD; g.fill(); g.strokeStyle = INK; g.lineWidth = m * 0.045; g.stroke();
    burst(g, m, 16, m * 0.74, m * 0.86, Math.PI / 16); g.fillStyle = CORAL; g.fill(); g.lineWidth = m * 0.03; g.stroke();
    g.beginPath(); g.arc(m, m, m * 0.73, 0, Math.PI * 2); g.lineWidth = m * 0.05; g.stroke();
  };
  const drawHand = (g, w) => {   // Fingerzeig als Comic-Sticker: Elfenbein-Kreis, schwarze Outline, harter Versatzschatten
    const m = w / 2, r = m * 0.86, o = w * 0.05;
    g.beginPath(); g.arc(m + o, m + o, r - o, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(m - o * 0.3, m - o * 0.3, r - o, 0, Math.PI * 2); g.fillStyle = IVORY; g.fill();
    g.lineWidth = w * 0.045; g.strokeStyle = INK; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${w * 0.55}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText('👆', m - o * 0.3, m + w * 0.02);
  };
  const LABEL_FONT = '400 84px Bangers, "Luckiest Guy", Impact, system-ui, sans-serif';
  const drawLabel = (g, w, h) => {   // „Antippen!“ als Comic-Banner: Senfgelb, schwarze Outline, harter Schatten, Display-Schrift
    g.clearRect(0, 0, w, h);
    const box = (x, y) => { g.beginPath(); g.roundRect(x, y, w - 30, h - 30, 18); };
    box(18, 20); g.fillStyle = INK; g.fill();
    box(8, 8); g.fillStyle = MUSTARD; g.fill(); g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
    g.font = LABEL_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = IVORY; g.strokeText('ANTIPPEN!', w / 2 - 7, h / 2 - 4);
    g.fillStyle = INK; g.fillText('ANTIPPEN!', w / 2 - 7, h / 2 - 4);
  };
  function labelTex() {
    const fresh = !texCache.label, tex = canvasTex('label', 512, 144, drawLabel);
    if (fresh && document.fonts) document.fonts.load(LABEL_FONT).then(() => { drawLabel(tex.image.getContext('2d'), 512, 144); tex.needsUpdate = true; }, () => {});
    return tex;
  }
  /** Badge-Textur: fertiges PNG (eigene Transparenz) oder gezeichneter Platzhalter mit Goldring, Elfenbein und Motiv je Thema. */
  function badgeTexture(img, theme) {
    if (img) {   // fertiger Badge (PNG mit Transparenz): unverändert, quadratisch
      // 1024² (Zweierpotenz) → Mipmaps; trilinear + Anisotropie, damit das Icon schräg und verkleinert scharf bleibt. sRGB = farbtreu.
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = sceneEl.renderer ? sceneEl.renderer.capabilities.getMaxAnisotropy() : 4;
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
      // ig: Billboard (schaut immer zur Kamera) mit Ring, Icon, Hand und Schriftzug; spin: Icon pendelt ±15° um die Hochachse.
      // Beidseitig: zweites Mesh um 180° gedreht mit demselben Material → Rückseite zeigt das Bild ungespiegelt.
      // Alles ohne Tiefentest und in fester Reihenfolge gezeichnet: liegt immer über Truhe und Paar, keine Sortierfehler. 5 Draw-Calls.
      const ig = new THREE.Group(), spin = new THREE.Group();
      const over = (map, o) => new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, ...o });
      const plane = (w, h, mat, order) => Object.assign(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), { renderOrder: order });
      const mat = over(badgeTexture(null, icon.theme), { alphaTest: 0.1 });
      const disc = plane(ICON_R * 2, ICON_R * 2, mat, 3), back = new THREE.Mesh(disc.geometry, mat);
      back.rotation.y = Math.PI;
      back.renderOrder = 3;
      disc.name = 'icon-front'; back.name = 'icon-back';
      const ring = plane(ICON_R * 2.8, ICON_R * 2.8, over(canvasTex('ring', 512, 512, drawRing)), 2);   // Burst-Spitzen bis 1,36 × Icon-Radius
      const label = plane(ICON_R * 1.7, ICON_R * 1.7 * 144 / 512, over(labelTex()), 4);
      const hand = plane(ICON_R * 0.7, ICON_R * 0.7, over(canvasTex('hand', 256, 256, drawHand)), 5);
      hand.rotation.z = 0.55;   // Finger zeigt nach links oben aufs Icon
      spin.add(disc, back);
      ig.add(ring, spin, label, hand);
      ig.visible = false;
      up.add(ig);   // nicht in g: soll nicht mitwackeln, nur über der Truhe stehen
      u.icon = { g: ig, spin, disc, ring, label, hand, off: U(4, 4).sub(cp).setY(0).multiplyScalar(ICON_IN) };
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
  const qUp = new THREE.Quaternion(), qCam = new THREE.Quaternion(), vC = new THREE.Vector3(), vE = new THREE.Vector3();
  /** Ragt das Billboard (Ring seitlich/oben, Schriftzug unten) aus dem Bild, entlang der Bildschirmachsen hereinschieben. */
  function keepOnScreen(ig) {
    const cam = sceneEl.camera, R = ICON_R * 1.3;   // Burst-Spitzen (bis 1,36 R, meist weniger)
    ig.updateMatrixWorld();
    ig.localToWorld(vC.set(0, 0, 0)).project(cam);
    ig.localToWorld(vE.set(R, 0, 0)).project(cam);
    let rx = Math.hypot(vE.x - vC.x, vE.y - vC.y);     // Radius in NDC-x (Billboard: rechts = Bildschirm-rechts)
    if (!(rx > 0) || Math.abs(vC.z) > 1) return;       // hinter der Kamera / entartet
    // Nah dran (Brett füllt das Bild) wird das Icon sonst bildschirmfüllend: Burst höchstens 40 % der kurzen Bildseite als Radius
    const maxRx = 0.8 * Math.min(1, 1 / cam.aspect);   // NDC: Breite = 2
    if (rx > maxRx) { ig.scale.multiplyScalar(maxRx / rx); rx = maxRx; }
    const ry = rx * cam.aspect, bottom = ry * 1.15;    // NDC-y ist um das Seitenverhältnis gestreckt; Schriftzug reicht 1,36 R tief
    const dx = Math.max(0, -1 - (vC.x - rx)) - Math.max(0, vC.x + rx - 1);
    const dy = Math.max(0, -1 - (vC.y - bottom)) - Math.max(0, vC.y + ry - 1);
    if (dx || dy) { ig.translateX((dx / rx) * R * ig.scale.x); ig.translateY((dy / ry) * R * ig.scale.y); }
  }
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
    // 5) Icon steigt aus der Truhe (leicht zur Brettmitte), schwebt auf und ab, schaut zur Kamera und pendelt ±15°.
    //    Ring pulsiert, die Hand tippt alle 1,5 s aufs Icon (Ring leuchtet beim Tipp auf), darunter „Antippen!“.
    if (u.icon) {
      const { g: ig, spin, ring, label, hand, off } = u.icon, k = clamp01((t - 1.6) / 0.8), e = easeOutBack(k);
      ig.visible = k > 0;
      if (!ig.visible) iconFilter.reset();
      else {
        const top = g.position.y + s.position.y + H;
        // ruhig: langsames, kleines Wippen (ohne das Wippen der Truhe, das die Höhe sonst doppelt schaukeln lässt)
        ig.position.set(g.position.x + off.x * e, g.position.y + H + 0.035 * lift + 0.01 + ICON_UP * e + Math.sin(time * 1.4) * cell * 0.05 * k, g.position.z + off.z * e);
        if (k < 1) ig.position.y = Math.max(ig.position.y, top + 0.01);   // beim Aufsteigen nicht unter dem Truhenrand
        ig.scale.setScalar(Math.max(0.001, smooth(k * 1.3) * out));
        if (sceneEl.camera) {   // Billboard: gleiche Ausrichtung wie die Kamera (auch genau von oben eindeutig)
          up.updateWorldMatrix(true, false);
          up.getWorldQuaternion(qUp).invert().multiply(sceneEl.camera.getWorldQuaternion(qCam));
          if (Number.isFinite(qUp.x + qUp.w)) {
            ig.quaternion.copy(qUp);
            keepOnScreen(ig);
            // Position in Weltkoordinaten glätten: Drehfehler des Bretts wirken über den Hebelarm (Icon schwebt hoch) verstärkt
            up.localToWorld(vIcon.copy(ig.position));
            if (Number.isFinite(vIcon.x + vIcon.y + vIcon.z)) up.worldToLocal(ig.position.copy(iconFilter.filter(vIcon, null, dtLast).pos));
          }
        }
        spin.rotation.y = Math.sin(time * 0.7) * 0.14 * k + (1 - k) * Math.PI * 2;   // ±8° pendeln; beim Aufsteigen eine Drehung
        const p = (time % TAP_S) / TAP_S, press = Math.exp(-(((p - 0.42) / 0.07) ** 2));   // press: 1 im Moment des Tipps
        const reach = smooth(p / 0.4) * (1 - smooth((p - 0.45) / 0.35)), d = ICON_R * 0.22 * (1 - reach);
        hand.position.set(ICON_R * 0.95 + d, -ICON_R * 0.6 - d, 0);
        hand.scale.setScalar(1 - 0.15 * press);
        ring.scale.setScalar(1 + 0.03 * Math.sin(time * 3) + 0.1 * press);
        if (!REDUCED) ring.rotation.z = time * 0.25;   // Burst dreht sich langsam (Comic-Effekt)
        ring.material.opacity = k;
        label.position.y = -ICON_R * 1.15;
        hand.material.opacity = label.material.opacity = smooth((t - 2.3) / 0.3);   // erst wenn das Icon steht
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
  /** Tipp trifft das Icon: innerhalb 1,6 × Icon-Radius (deckt Ring, Hand und Schriftzug), mindestens 60 px um die Icon-Mitte. */
  function iconHit(e) {
    const r = iconRect();
    return !!r && Math.hypot(e.clientX - r.x - r.width / 2, e.clientY - r.y - r.height / 2) <= Math.max(60, r.width * 0.8);
  }
  function showCard(r, c, { icon, theme } = {}) {
    const u = showTreasure(r, c, { src: icon || (theme ? `assets/ui/icon-${theme}.webp` : null), theme });
    return new Promise((res) => { u.resolve = (v) => { u.resolve = () => {}; res(v); }; });
  }

  // --- Bewegung (eigene rAF-Schleife; läuft auch weiter, wenn das Ziel kurz verloren ist) ---
  let curIdx = 0, active = -1, reached = -1, move = null, cheerT = 0, litColor = null, time = 0, dtLast = 0, last = performance.now(), raf = 0;
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
    last = now; time += dt; dtLast = dt;
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
      if (time - u.t0 > 1.5 || (isTracking() && u.icon.g.visible && iconHit(e))) u.resolve(iconRect());
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
.ar-scan .ar-frame{width:min(68vw,52vh);aspect-ratio:1;border:4px dashed #f2b632;border-radius:18px;outline:2px solid #1b1f3b;outline-offset:2px;box-shadow:0 0 0 2000px rgba(0,0,0,.25);animation:ar-pulse 1.6s ease-in-out infinite}
.ar-scan[hidden] .ar-frame{animation:none}
.ar-scan .ar-msg{max-width:84%;padding:10px 16px;border-radius:14px;background:#fff8e8;border:3px solid #1b1f3b;box-shadow:4px 4px 0 #1b1f3b;color:#1b1f3b;font:700 16px/1.35 Nunito,system-ui,sans-serif;text-align:center}
.ar-scan .ar-msg small{display:block;font-weight:400;font-size:13px;opacity:.9;margin-top:4px}
.ar-scan.lost .ar-frame{display:none}
.ar-scan.lost{justify-content:flex-start;padding-top:calc(env(safe-area-inset-top) + 64px)}
.ar-near{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 64px);transform:translateX(-50%);z-index:3;margin:0;pointer-events:none;white-space:nowrap;padding:8px 14px;border-radius:999px;background:#f2b632;border:3px solid #1b1f3b;box-shadow:3px 3px 0 #1b1f3b;color:#1b1f3b;font:800 15px/1.2 Nunito,system-ui,sans-serif}
.ar-near[hidden]{display:none}
.ar-rot{position:fixed;inset:0;z-index:25;display:none;align-items:center;justify-content:center;padding:24px;background:#1b1f3b;color:#fff8e8;font:700 20px/1.4 Nunito,system-ui,sans-serif;text-align:center}
@media (orientation:landscape) and (max-height:599px){.ar-rot{display:flex}}
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
  // Feintuning per URL (docs/AR.md „Runde 5“). MindARs eigener One-Euro-Filter (Zeit in ms, pro Matrixelement) bleibt
  // neutral (mincf 1, beta 0 = aus); geglättet wird die Pose stattdessen auf dem Anker `ar-anchor` (makePoseSmoother, Sekunden):
  //   smooth  Grenzfrequenz im Stillstand in Hz (0 = aus), sbeta: wie schnell sie bei Bewegung steigt, sdcf: Glättung der Geschwindigkeit
  //   ismooth Icon-Grenzfrequenz im Stillstand (Hz), hold: Sekunden, die die letzte Pose nach Verlust stehen bleibt (danach 0,4 s ausblenden)
  //   res     Videowunsch kurze Seite (720 Standard, 1080, 0 = Browser-Vorgabe), miss/warm: MindAR missTolerance/warmupTolerance (Frames)
  const num = (k, d) => (q.has(k) && Number.isFinite(+q.get(k)) ? +q.get(k) : d);
  const minCF = num('mincf', 1), beta = num('beta', 0);
  const sm = { minCF: num('smooth', 0.5), beta: num('sbeta', 40), dCF: num('sdcf', 1) };
  const iconSmooth = { minCF: num('ismooth', 0.4) };
  const HOLD = num('hold', 1.2), FADE = 0.4, RES = num('res', 720), MISS = num('miss', 20), WARM = num('warm', 4);
  //   fov     Bildwinkel der Kamera über die lange Bildseite in Grad (0 = MindAR-Vorgabe 45° über die Höhe), near: ab welcher
  //           Brettbreite (× kurze Videoseite) der 256-px-Tracker übernimmt (0 = nie), nhold: Haltezeit, wenn das Brett zuletzt
  //           gross im Bild war (ab nfar × kurze Seite); dazu der Hinweis „Etwas weiter weg halten“
  tune.fov = num('fov', 70); tune.near = num('near', 1); tune.near2 = num('near2', 1.5);
  //   tjump / tvis  Plausibilität der Zielpose (Kacheln): grösster Eckensprung pro Frame (× Zielbreite), Mindestanteil einer Kachel im Bild
  tune.jump = num('tjump', 0.35); tune.vis = num('tvis', 0.1); tune.edge = num('tedge', 12);   // tedge: Randabstand der Tracking-Punkte (px)
  const NHOLD = num('nhold', 5), NFAR = num('nfar', 1.6);
  //   tiles   0 = Kachel-Ziele nicht anzeigen (MindAR verfolgt sie trotzdem, wenn sie in targets.mind stehen; zum Vergleichen)
  let tiles = [];

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
  const [[aspect]] = await Promise.all([
    Promise.all(TARGET_IMGS.map((src, k) => new Promise((res) => {   // beide Ziele sind gleich gross (1000×1000, gleiche tileArea)
      const i = new Image();
      i.onload = () => { tune.imgs[k] = i; res(i.naturalHeight / i.naturalWidth || 1); };
      i.onerror = () => res(1);
      i.src = src;
    }))),
    (async () => {
      if (!window.AFRAME) await loadScript(AFRAME_SRC);
      if (!window.AFRAME.components['mindar-image']) await loadScript(MINDAR_SRC);
      patchMindar();
    })(),
    checkTargets(targetSrc),
    // Kachel-Ziele (Index 2 …): Lage im Brett, gleiche Reihenfolge wie in targets.mind (tools/compile-target.html liest dieselbe Datei)
    num('tiles', 1) ? fetch(TILES_SRC).then((r) => (r.ok ? r.json() : { tiles: [] })).then((j) => { tiles = j.tiles || []; }, () => {}) : null,
  ]).catch(bail);
  if (!container.isConnected) bail(named('Cancelled', 'abgebrochen'));
  onPhase('permission');
  let cam = await gum(RES).catch(bail);
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
  mindar-image="imageTargetSrc: ${targetSrc}; maxTrack: 1; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: ${minCF}; filterBeta: ${beta}; missTolerance: ${MISS}; warmupTolerance: ${WARM}">
  <a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
  <a-entity id="ar-target" class="ar-tgt" mindar-image-target="targetIndex: 0"></a-entity>
  <a-entity id="ar-target-schmuck" class="ar-tgt" mindar-image-target="targetIndex: 1"></a-entity>
  ${tiles.map((_, k) => `<a-entity class="ar-tgt" mindar-image-target="targetIndex: ${k + 2}"></a-entity>`).join('')}
</a-scene>
<div class="ar-scan" role="status" aria-live="polite"><div class="ar-frame"></div>
  <p class="ar-msg">Haltet die Kamera ruhig auf das Spielbrett<small>Am besten von oben, bei gutem Licht</small></p></div>`);
  const sceneEl = container.querySelector('a-scene');
  // Ein Brett, viele Ziele: 0 = ohne Schmuck, 1 = mit Schmuck (docs/AR.md „Schmuck“), ab 2 Kacheln (Ausschnitte, „Kacheln“).
  // maxTrack 1 → MindAR verfolgt immer nur eines. XF[i]: Ziel-i-Koordinaten → Brett-Koordinaten (Brettpose = Zielpose × XF[i]).
  const targetEls = [...container.querySelectorAll('.ar-tgt')];
  const TH = window.AFRAME.THREE, XF = targetEls.map(() => new TH.Matrix4()), BASE = [0, 1];
  tiles.forEach((t, k) => {
    const [x0, y0, x1, y1] = t.rect, sc = x1 - x0;
    tune.scale[k + 2] = sc; BASE[k + 2] = t.base;
    XF[k + 2] = new TH.Matrix4().makeScale(1 / sc, 1 / sc, 1 / sc).multiply(new TH.Matrix4().makeTranslation(-((x0 + x1) / 2 - 0.5), -((0.5 - (y0 + y1) / 2) * aspect), 0));
  });
  const boardM = new TH.Matrix4();
  const boardMatrix = (i) => boardM.multiplyMatrices(targetEls[i].object3D.matrix, XF[i]);
  const scan = container.querySelector('.ar-scan');
  const msg = scan.querySelector('.ar-msg');
  const rot = Object.assign(document.createElement('div'), { className: 'ar-rot', textContent: '📱 Bitte im Hochformat spielen' });
  document.body.append(rot);   // ausserhalb des Hosts: muss auch über dem Quiz-Panel liegen

  let tracking = false, stage = null, iv = 0, live = false, restarting = false, fatalSent = false, visT = 0, rotT = 0;
  const nearEl = Object.assign(document.createElement('p'), { className: 'ar-near', hidden: true, textContent: '↕ Etwas weiter weg halten' });
  container.append(nearEl);
  let nearLoss = false;   // Brett war beim Verlust gross im Bild → länger halten (NHOLD)
  let nearMsg = false;    // auch das verfolgte Ziel (Kachel) war gross → Hinweis „zu nah“
  const showLost = () => {
    scan.classList.add('lost');
    msg.innerHTML = nearMsg ? 'Zu nah dran – haltet die Kamera etwas weiter weg<small>So sieht sie mehr vom Brett. Das Spiel läuft weiter.</small>'
      : 'Brett aus dem Blick – haltet die Kamera wieder aufs Brett<small>Das Spiel läuft weiter.</small>';
    scan.hidden = false;
  };

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
  // Anker `ar-anchor`: trägt alle Inhalte, bekommt die geglättete Pose. Verliert MindAR das Ziel, bleibt die letzte Pose HOLD s
  // stehen und blendet dann in FADE s aus (Canvas-Deckkraft); erst danach kommt der Hinweis. Wiedergefunden in der Haltezeit:
  // weich weiter, sonst springt der Anker direkt auf die neue Pose.
  const THREE = window.AFRAME.THREE;
  const anchor = Object.assign(new THREE.Group(), { name: 'ar-anchor', matrixAutoUpdate: false, visible: false });
  sceneEl.object3D.add(anchor);
  const smoother = (anchor.userData.smoother = makePoseSmoother(THREE, sm));
  let poseT = 0, lostAt = 0;
  const setFade = (o) => { if (sceneEl.canvas) sceneEl.canvas.style.opacity = o >= 1 ? '' : String(o); };
  const hideNow = () => { lostAt = 0; anchor.visible = false; tracking = false; setFade(1); };
  const targetComp = (i) => targetEls[i].components['mindar-image-target'];
  // Der Anker folgt dem Ziel `active`. Beide Posen beschreiben dasselbe Brett (gleiche Grösse, gleiche tileArea), deshalb
  // läuft die Glättung beim Wechsel einfach weiter: kein Sprung, kein Neustart der Figuren.
  // Wechsel nur, wenn MindAR das aktive Ziel gerade nicht verfolgt: Während missTolerance schickt MindAR für das alte Ziel
  // weiter seine letzte (stehende) Pose, die darf die frische Pose des anderen nicht überschreiben.
  let active = 0;
  const isTracked = (i) => { const st = sys().controller && sys().controller.trackingStates; return !!(st && st[i] && st[i].isTracking); };
  anchor.userData.raw = () => ({ matrix: boardMatrix(active).clone() });   // rohe Brettpose aus dem aktiven Ziel (Messskript)
  anchor.userData.active = () => active;
  // Übernahme durch ein anderes Ziel kurz nach dem Verlust: Liegt dessen Brettpose weit neben der zuletzt gezeigten (Winkel der
  // Zielmitte > (0,3 + 1,5/s · Zeit seit der letzten Pose) × Zielbreite), ist es eine Fehlerkennung (gemessen beim Schwenk nah:
  // Kachel mit Brett ~1000 px daneben). Nach Ablauf der Haltezeit (Anker unsichtbar) wird jede Erkennung genommen.
  const vA = new TH.Vector3(), vB = new TH.Vector3(), vC = new TH.Vector3();
  const BLEND = 0.3, blendD = new TH.Matrix4(), blendM = new TH.Matrix4(), bp = new TH.Vector3(), bq = new TH.Quaternion(), bs = new TH.Vector3();
  const qI = new TH.Quaternion(), sI = new TH.Vector3(1, 1, 1);
  let blendT = 0;
  const startBlend = (i, now) => { if (anchor.visible) { blendD.copy(anchor.matrix).multiply(boardMatrix(i).invert()); blendT = now; } };
  const implausible = (i, dt) => {
    if (dt > 1.5) return false;
    const sc = tune.scale[i] || 1, M = boardMatrix(i), c = new TH.Vector3().setFromMatrixPosition(XF[i].clone().invert());
    vA.copy(c).applyMatrix4(anchor.matrix); vB.copy(c).applyMatrix4(M); vC.copy(c).setX(c.x + sc).applyMatrix4(M);
    const ang = vA.angleTo(vB), size = vB.angleTo(vC);
    return !(ang <= (0.3 + 1.5 * dt) * size);
  };
  const hookTarget = () => {   // nach 'loaded' der Szene (vorher gibt es die Komponente evtl. noch nicht), vor MindARs Start
    targetEls.forEach((el, i) => {
      const tc = targetComp(i), upd0 = tc && tc.updateWorldMatrix;
      if (!upd0) return;
      tc.updateWorldMatrix = function (wm) {
        upd0.call(this, wm);
        const now = performance.now();
        if (!wm) {
          if (i !== active) return;
          const other = targetEls.findIndex((e, k) => k !== i && e.object3D.visible);
          if (other >= 0) { active = other; startBlend(other, now); return; }   // ein anderes Ziel zeigt schon: dort weiter
          if (anchor.visible && !lostAt) { lostAt = now; nearLoss = tune.boardPx / tune.short >= NFAR; nearMsg = tune.tilePx / tune.short >= NFAR; }
          return;
        }
        if (i !== active) {
          if (anchor.visible && !lostAt && isTracked(active)) return;   // aktives Ziel läuft noch: anderes ignorieren
          if (anchor.visible && implausible(i, (now - poseT) / 1000)) {   // Fehlerkennung (sich wiederholendes Labyrinth-Muster)
            const st = sys().controller && sys().controller.trackingStates;
            if (st && st[i]) st[i].isTracking = false;   // MindAR sucht im nächsten Frame neu
            return;
          }
          active = i;
          // Wechsel ohne Sprung: die beiden Ziele schätzen das Brett um einige px verschieden. Den Unterschied als Korrektur
          // merken und in BLEND s auf null abbauen (statt ihn in einem Frame durchzureichen; gemessen bis 47 px Sprung).
          startBlend(i, now);
        }
        if (!anchor.visible) { smoother.reset(); blendT = 0; }
        let M = boardMatrix(i);   // Kachel: Kachelpose × XF = Brettpose
        const bk = blendT ? 1 - (now - blendT) / 1000 / BLEND : 0;
        if (bk > 0) {
          blendD.decompose(bp, bq, bs); bp.multiplyScalar(bk); bq.slerp(qI, 1 - bk); bs.lerp(sI, 1 - bk);
          M = blendM.compose(bp, bq, bs).multiply(M);
        } else blendT = 0;
        smoother.filterMatrix(M, (now - poseT) / 1000, anchor.matrix);
        anchor.matrixWorldNeedsUpdate = true;
        poseT = now;
        if (lostAt || !anchor.visible) { lostAt = 0; setFade(1); anchor.visible = tracking = true; scan.hidden = true; }
      };
    });
  };
  (function holdTick() {
    if (destroyed) return;
    if (lostAt) {
      const k = (performance.now() - lostAt) / 1000 - (nearLoss ? NHOLD : HOLD);
      if (k >= FADE) { hideNow(); showLost(); } else setFade(k > 0 ? 1 - k / FADE : 1);
    }
    // „Etwas weiter weg halten“: solange das Brett sehr gross im Bild ist (oder nah verloren und noch gehalten)
    // Kacheln: nach der Breite des verfolgten Ziels, nicht des Bretts (nah dran übernimmt eine Kachel, das ist gewollt)
    const big = anchor.visible && (lostAt ? nearMsg : tune.tilePx / tune.short >= (nearEl.hidden ? NFAR : NFAR * 0.9));
    if (nearEl.hidden === big) nearEl.hidden = !big;
    requestAnimationFrame(holdTick);
  })();
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
    targetEls.forEach((el, i) => { if (el.object3D.visible && targetComp(i)) targetComp(i).updateWorldMatrix(null); });
    hideNow();   // altes Bild nicht stehen lassen (keine Haltezeit beim Neustart)
    nearLoss = nearMsg = false;
    scan.classList.remove('lost');
    msg.innerHTML = 'Kamera startet neu …<small>Haltet die Kamera aufs Brett</small>';
    scan.hidden = false;
    try {
      sys().stop();
      cam = await gum(RES);
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
  // Gerät gedreht (Handy zurück ins Hochformat, iPad in beide Richtungen): haben sich die Videomasse geändert, passt MindARs
  // Eingabegrösse nicht mehr → Neustart. Handy quer zeigt nur den Hinweis „Bitte im Hochformat“ (dort kein Neustart).
  const portrait = matchMedia('(orientation: portrait)'), phoneLand = matchMedia('(orientation: landscape) and (max-height: 599px)');
  const onOrient = () => {
    clearTimeout(rotT);
    if (phoneLand.matches || !live) return;
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
    hookTarget();
    // iPhone hat 3: 1.5 reicht für die kleinen Low-Poly-Figuren und lässt der Bilderkennung (TF.js, gleiche GPU) mehr Luft
    if (sceneEl.renderer) sceneEl.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    const board = buildBoard({ sceneEl, anchor, aspect, debug, isTracking: () => tracking, iconSmooth });
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
    targetEls.forEach((el) => el.addEventListener('targetUpdate', () => nUpd++));
    (function count(now) {
      if (destroyed) return;
      nFr++;
      if (now - t > 1000) {
        const v = sys().video, k = 1000 / (now - t);
        hud.textContent = `Video ${v ? v.videoWidth + '×' + v.videoHeight : '?'} · Tracking ${Math.round(nUpd * k)}/s · Bild ${Math.round(nFr * k)}/s · smooth ${sm.minCF}/${sm.beta} · hold ${HOLD} · mincf ${minCF} · Ziel ${(BASE[active] ? 'Schmuck' : 'ohne') + (active > 1 ? ' Kachel ' + (active - 2) : '')}`;
        nUpd = nFr = 0; t = now;
      }
      requestAnimationFrame(count);
    })(t);
  }
  tracking = anchor.visible;
  live = true;
  onPhase('ready');
  return { ...stage, destroy: cleanup };
}
