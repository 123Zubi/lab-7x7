// Messungen AR-Stabilität (docs/AR.md „Runde 5“): Fake-Kamera + echtes MindAR, createArStage direkt in app/index.html.
//   python3 -m http.server 8105 --bind 127.0.0.1      (im Projektordner)
//   node app/dev/ar-messung.mjs <mode> [url-query]     mode = rest|icon|shift|roll|dist|detect|nah
// env PORT (8105), PHOTO (IMG_6831 oder Pfad relativ zu app/, z. B. ../Fotos/Nahaufnahmen/IMG_6862.jpg), VW/VH (Viewport 390×844)
// env: NOISE (Bildrauschen, 0.15), W/H (Videogrösse, 720×1280), ICON=1 (shift: Icon statt Brett), ZS (detect: Zoomstufen),
//      PLAYWRIGHT (Ordner mit node_modules/playwright). Ausgabe: JSON je Lauf; „roh“ = MindAR-Pose, „anzeige“/„brett“ = Anker.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT || '/Users/janoszuberbuhler/.npm/_npx/bc46ece8a1067505/node_modules/');
const { chromium } = require('playwright');
const [MODE, QUERY = ''] = process.argv.slice(2);
const W = +(process.env.W || 720), H = +(process.env.H || 1280), PHOTO = process.env.PHOTO || 'IMG_6831';
const NOISE = +(process.env.NOISE ?? 0.15), PORT = process.env.PORT || 8105;
const VW = +(process.env.VW || 390), VH = +(process.env.VH || 844);
const SRC = PHOTO.includes('/') ? PHOTO : `../Fotos/${PHOTO}.jpeg`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const r2 = (x) => Math.round(x * 100) / 100;

async function open(zoom = 1, query = QUERY) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errs.push(m.text()));
  await page.goto(`http://localhost:${PORT}/app/index.html?reset=1&${query}`);
  const ok = await page.evaluate(async ({ SRC, NOISE, W, H, zoom }) => {
    const fc = await import('./dev/fake-camera.js?v=' + Date.now());
    const cv = await fc.install(SRC, { wobble: 0, noise: NOISE, width: W, height: H });
    cv.zoom = zoom;
    const host = Object.assign(document.createElement('div'), { id: 'mhost' });
    host.style.cssText = 'position:fixed;inset:0;z-index:9999';
    document.body.append(host);
    const { createArStage } = await import('./js/ar.js');
    window.__stage = await createArStage(host);
    window.__raw = { found: 0, lost: 0, upd: 0, idx: -1 };   // zwei Ziele (ohne/mit Schmuck): Ereignisse von beiden, idx = zuerst erkanntes
    document.querySelectorAll('.ar-tgt').forEach((tg, i) => {
      tg.addEventListener('targetFound', () => { __raw.found = performance.now(); if (__raw.idx < 0) __raw.idx = i; });
      // verloren erst, wenn kein Ziel mehr sichtbar ist (beim Wechsel 0↔1 meldet das alte Ziel targetLost)
      tg.addEventListener('targetLost', () => { if (![...document.querySelectorAll('.ar-tgt')].some((e) => e !== tg && e.object3D.visible)) __raw.lost = performance.now(); });
      tg.addEventListener('targetUpdate', () => __raw.upd++);
    });
    return true;
  }, { SRC, NOISE, W, H, zoom }).catch((e) => 'ERR ' + e.message);
  return { page, errs, ok };
}
// in der Seite: Bildschirmpunkt eines Zielpunkts auf dem angezeigten Anker (neu: 'ar-anchor', alt: #ar-target)
const HELPERS = () => {
  const sc = document.querySelector('a-scene'), THREE = AFRAME.THREE;
  const A = () => sc.object3D.getObjectByName('ar-anchor');
  window.__rawM = () => A().userData.raw().matrix;   // rohe MindAR-Pose des gerade aktiven Ziels
  const v = new THREE.Vector3(), rect = sc.canvas.getBoundingClientRect();
  window.__shown = () => A().visible;
  window.__pt = (x, y, z, m) => { v.set(x, y, z).applyMatrix4(m || A().matrix).project(sc.camera); return [(v.x * 0.5 + 0.5) * rect.width, (-v.y * 0.5 + 0.5) * rect.height]; };
  window.__icon = () => { let f = null; sc.object3D.traverse((m) => { if (m.name === 'icon-front') f = m; }); if (!f) return null; f.getWorldPosition(v); v.project(sc.camera); return [(v.x * 0.5 + 0.5) * rect.width, (-v.y * 0.5 + 0.5) * rect.height]; };
  window.__waitShown = async (ms) => { const t0 = performance.now(); while (!A().visible) { if (performance.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 30)); } return true; };
};

const PROG = [[1.5, 0], [1.0, 100], [2.0, 100], [1.0, 0], [2.0, 0], [0.5, 100], [2.0, 100], [0.5, 0], [2.0, 0]];
async function latency(roll) {
  const { page, errs, ok } = await open();
  if (ok !== true) return console.log(ok, errs);
  const r = await page.evaluate(async ({ PROG, roll, HELP, ICON }) => {
    eval('(' + HELP + ')()');
    if (!(await __waitShown(20000))) return { err: 'nicht erkannt' };
    if (ICON) { await __stage.walkTo(4, { instant: true }); __stage.showCard(4, 4, { theme: 'flitterwochen', icon: 'assets/ui/icon-flitterwochen.png' }); await new Promise((r) => setTimeout(r, 2500)); }
    await new Promise((r) => setTimeout(r, 1500));
    const samples = [], raw = [], total = PROG.reduce((a, p) => a + p[0], 0), M = { get matrix() { return __rawM(); } };
    const prog = (t) => { let s = 0, from = 0; for (const [d, to] of PROG) { if (t < s + d) return from + (to - from) * Math.min(1, (t - s) / d); s += d; from = to; } return from; };
    const start = performance.now(), u0 = __raw.upd; let fr = 0;
    const meas = (m) => { const [px, py] = __pt(0.4, -0.4, 0.06, m), [ox, oy] = __pt(0, 0, 0, m); return roll ? Math.atan2(py - oy, px - ox) * 1800 / Math.PI : px; };
    await new Promise((res) => (function f() {
      const t = (performance.now() - start) / 1000; fr++;
      if (t > total) return res();
      const dx = prog(t);
      if (roll) __fakeCam.rot = dx * Math.PI / 1800; else __fakeCam.dx = dx;
      samples.push([t, dx, ICON ? __icon()[0] : meas()]); raw.push([t, dx, meas(M.matrix)]);
      requestAnimationFrame(f);
    })());
    return { samples, raw, hz: (__raw.upd - u0) / total, fps: fr / total };
  }, { PROG, roll, HELP: HELPERS.toString(), ICON: !!process.env.ICON });
  await page.close();
  if (r.err) return console.log(r.err, errs);
  const segs = []; { let s = 0, from = 0; for (const [d, to] of PROG) { segs.push({ s, e: s + d, from, to }); s += d; from = to; } }
  const ana = (S) => {
    const hold = S.filter(([t]) => segs.some((g) => g.from === g.to && t > g.e - 1 && t <= g.e));
    const x0 = mean(hold.filter((p) => p[1] === 0).map((p) => p[2])), k = (mean(hold.filter((p) => p[1] === 100).map((p) => p[2])) - x0) / 100;
    const o = (p) => (p[2] - x0) / k, lag = [], set = [];
    for (const g of segs) if (g.from !== g.to) {
      const vel = (g.to - g.from) / (g.e - g.s);
      const lags = S.filter(([t]) => t > g.s + (g.e - g.s) * 0.5 && t <= g.e).map((p) => (p[0] - g.s) - (o(p) - g.from) / vel).sort((a, b) => a - b);
      const after = S.filter(([t]) => t > g.e);
      const settle = after.find((p) => after.filter((q) => q[0] >= p[0] && q[0] < p[0] + 0.3).every((q) => Math.abs(o(q) - g.to) < (roll ? 3 : 5)));
      lag.push(Math.round(lags[lags.length >> 1] * 1000)); set.push(settle ? Math.round((settle[0] - g.e) * 1000) : 'nie');
    }
    return { k: r2(k), lag: lag.join('/'), settle: set.join('/') };
  };
  console.log(JSON.stringify({ mode: (roll ? 'roll' : 'shift') + (process.env.ICON ? '-icon' : ''), q: QUERY, hz: r2(r.hz), fps: r2(r.fps), roh: ana(r.raw), anzeige: ana(r.samples), errs }));
}

// Stand: Zittern des Bretts (Punkt auf (7,7)-Höhe) und des Icons; HP = Abweichung vom gleitenden Mittel ±7 Frames
const hp = (P) => { const out = []; for (let i = 7; i < P.length - 7; i++) { const w = P.slice(i - 7, i + 8); out.push(Math.hypot(P[i][0] - mean(w.map((q) => q[0])), P[i][1] - mean(w.map((q) => q[1])))); } return Math.sqrt(mean(out.map((d) => d * d))); };
const stepRms = (P) => { const d = []; for (let i = 1; i < P.length; i++) d.push(Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return Math.sqrt(mean(d.map((x) => x * x))); };
async function rest(withIcon) {
  const { page, errs, ok } = await open();
  if (ok !== true) return console.log(ok, errs);
  const r = await page.evaluate(async ({ withIcon, HELP }) => {
    eval('(' + HELP + ')()');
    if (!(await __waitShown(20000))) return { err: 'nicht erkannt' };
    if (withIcon) { await __stage.walkTo(4, { instant: true }); __stage.showCard(4, 4, { theme: 'flitterwochen', icon: 'assets/ui/icon-flitterwochen.png' }); }
    await new Promise((r) => setTimeout(r, withIcon ? 3500 : 1500));
    const B = [], R = [], I = [], start = performance.now(), u0 = __raw.upd;
    await new Promise((res) => (function f() {
      if (performance.now() - start > 6000) return res();
      B.push(__pt(0.4, -0.4, 0.06)); R.push(__pt(0.4, -0.4, 0.06, __rawM())); const ic = __icon(); if (ic) I.push(ic);
      requestAnimationFrame(f);
    })());
    return { B, R, I, hz: (__raw.upd - u0) / 6, lost: __raw.lost > 0 };
  }, { withIcon, HELP: HELPERS.toString() });
  await page.close();
  if (r.err) return console.log(r.err, errs);
  const sd = (P) => Math.hypot(std(P.map((p) => p[0])), std(P.map((p) => p[1])));
  console.log(JSON.stringify({ mode: withIcon ? 'icon' : 'rest', q: QUERY, noise: NOISE, hz: r2(r.hz), roh: { std: r2(sd(r.R)), hp: r2(hp(r.R)) }, brett: { std: r2(sd(r.B)), hp: r2(hp(r.B)), step: r2(stepRms(r.B)) }, icon: r.I.length ? { hp: r2(hp(r.I)), step: r2(stepRms(r.I)), n: r.I.length } : null, errs }));
}

// Distanz beim Halten: Foto langsam verkleinern (−2 % alle 250 ms), bis MindAR das Ziel verliert
async function dist() {
  const { page, errs, ok } = await open();
  if (ok !== true) return console.log(ok, errs);
  const r = await page.evaluate(async ({ HELP }) => {
    eval('(' + HELP + ')()');
    if (!(await __waitShown(20000))) return { err: 'nicht erkannt' };
    await new Promise((r) => setTimeout(r, 1000));
    const sc = document.querySelector('a-scene'), tg = { object3D: { get matrix() { return __rawM(); } } };
    const vid = sc.systems['mindar-image-system'].video, rect = sc.canvas.getBoundingClientRect();
    const f = Math.max(rect.width / vid.videoWidth, rect.height / vid.videoHeight);   // Bildschirm-px je Video-px
    const bw = () => { const a = __pt(-0.5, 0, 0, tg.object3D.matrix), b = __pt(0.5, 0, 0, tg.object3D.matrix); return Math.hypot(a[0] - b[0], a[1] - b[1]) / f; };
    const w0 = bw(); let z = 1, lastW = w0; const u0 = __raw.upd, t0 = performance.now();
    __raw.lost = 0;
    while (z > 0.05) {
      z *= 0.98; __fakeCam.zoom = z;
      await new Promise((r) => setTimeout(r, 250));
      if (__raw.lost) break;
      lastW = bw();
    }
    const hidT = performance.now(); let hidden = null;
    if (__raw.lost) { while (performance.now() - hidT < 4000) { if (!__shown()) { hidden = Math.round(performance.now() - __raw.lost); break; } await new Promise((r) => setTimeout(r, 20)); } }
    return { video: vid.videoWidth + 'x' + vid.videoHeight, w0: Math.round(w0), lostZoom: Math.round(z * 1000) / 1000, lastBoardPx: Math.round(lastW), hz: (__raw.upd - u0) / ((performance.now() - t0) / 1000), hiddenAfterMs: hidden, ziel: __raw.idx };
  }, { HELP: HELPERS.toString() });
  await page.close();
  console.log(JSON.stringify({ mode: 'dist', q: QUERY, W, H, ...r, errs }));
}
// Erkennung aus dem Stand bei Zoom z (6 s Zeit)
async function detect() {
  const zs = (process.env.ZS || '0.7,0.5,0.4,0.33,0.27,0.22').split(',').map(Number), out = [];
  for (const z of zs) {
    const { page, errs, ok } = await open(z);
    if (ok !== true) { out.push([z, ok]); await page.close(); continue; }
    const t = await page.evaluate(async ({ HELP }) => { eval('(' + HELP + ')()'); const t0 = performance.now(); return (await __waitShown(6000)) ? Math.round(performance.now() - t0) : null; }, { HELP: HELPERS.toString() });
    out.push([z, t]); await page.close();
    if (errs.length) out.push(errs);
  }
  console.log(JSON.stringify({ mode: 'detect', q: QUERY, W, H, out }));
}
// Bildschirmfoto (env OUT=pfad.png, ZOOM, STATION 0..4 = Paar instant auf Station), z. B. für den Bildwinkel-Vergleich
async function shot() {
  const { page, errs } = await open(+(process.env.ZOOM || 1));
  const ok = await page.evaluate(async ({ HELP, ST }) => { eval('(' + HELP + ')()'); if (!(await __waitShown(8000))) return false; await __stage.walkTo(ST, { instant: true }); await new Promise((r) => setTimeout(r, 2500)); return true; }, { HELP: HELPERS.toString(), ST: +(process.env.STATION ?? 4) });
  await page.screenshot({ path: process.env.OUT });
  console.log(JSON.stringify({ mode: 'shot', q: QUERY, ok, out: process.env.OUT, errs }));
  await page.close();
}
// Nahbereich (docs/AR.md „Nah & iPad“): Erkennung bei Zoom 1 (Foto wie aufgenommen), sonst aus der Distanz (Zoom 0,6/0,45/0,35);
// danach langsam hineinzoomen (+3 % alle 250 ms bis Zoom ZMAX, Standard 5) und notieren, wann MindAR das Brett verliert.
// Brettbreite = Breite der ganzen 1-Einheit-Zielfläche in Video-px (bei Nahaufnahmen grösser als das Video).
async function nah() {
  const out = { mode: 'nah', q: QUERY, photo: SRC.split('/').pop(), W, H };
  let page, errs, z0 = null, tDet = null;
  for (const z of (process.env.ZS || '1,0.6,0.45,0.35').split(',').map(Number)) {
    ({ page, errs } = await open(z));
    tDet = await page.evaluate(async ({ HELP }) => { eval('(' + HELP + ')()'); const t0 = performance.now(); return (await __waitShown(+(new URLSearchParams(location.search).get('wait') || 6000))) ? Math.round(performance.now() - t0) : null; }, { HELP: HELPERS.toString() });
    if (tDet != null) { z0 = z; break; }
    await page.close(); page = null;
  }
  Object.assign(out, { erkanntBeiZoom: z0, ms: tDet });
  if (page) {
    const r = await page.evaluate(async ({ HELP, ZMAX }) => {
      eval('(' + HELP + ')()');
      const sc = document.querySelector('a-scene'), tg = { object3D: { get matrix() { return __rawM(); } } };
      const vid = sc.systems['mindar-image-system'].video, rect = sc.canvas.getBoundingClientRect();
      const f = Math.max(rect.width / vid.videoWidth, rect.height / vid.videoHeight);
      const bw = () => { const a = __pt(-0.5, 0, 0, tg.object3D.matrix), b = __pt(0.5, 0, 0, tg.object3D.matrix); return Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / f); };
      await new Promise((r) => setTimeout(r, 800));
      __raw.lost = 0;
      let z = __fakeCam.zoom || 1, w = bw(), w1 = null; const w0 = w;
      while (z < ZMAX && !__raw.lost) {
        z *= 1.03; __fakeCam.zoom = z;
        await new Promise((r) => setTimeout(r, 250));
        if (!__raw.lost) { w = bw(); if (z >= 1 && w1 == null) w1 = w; }
      }
      let held = null;
      if (__raw.lost) { const t = performance.now(); while (performance.now() - t < 8000) { if (!__shown()) { held = Math.round(performance.now() - __raw.lost); break; } await new Promise((r) => setTimeout(r, 20)); } }
      return { brettPxStart: w0, brettPxBeiZoom1: w1, verlorenBeiZoom: __raw.lost ? Math.round(z * 100) / 100 : '>' + ZMAX, brettPxZuletzt: w, einblendungWegNachMs: held, ziel: __raw.idx };
    }, { HELP: HELPERS.toString(), ZMAX: +(process.env.ZMAX || 5) });
    Object.assign(out, r); await page.close();
  }
  out.errs = errs;
  console.log(JSON.stringify(out));
}
if (MODE === 'shift') await latency(false);
if (MODE === 'roll') await latency(true);
if (MODE === 'rest') await rest(false);
if (MODE === 'icon') await rest(true);
if (MODE === 'dist') await dist();
if (MODE === 'detect') await detect();
if (MODE === 'nah') await nah();
if (MODE === 'shot') await shot();
await browser.close();
