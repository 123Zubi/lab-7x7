// Erkennungsrate über Fotosätze (app/dev/target-bench.html headless), docs/AR.md „Kacheln“.
//   node app/dev/bench-run.mjs <mind relativ zu app/dev> <satz>[,<satz>…] [asis | zmin=…&zmax=…&n=…]
// Sätze: nah2, nah, schmuck, ohne, video (Video-Frames: Fotos/Video/frames/*.jpg, immer asis). env PORT (8111).
// Ausgabe je Satz: erkannt/gesamt, Treffer je Ziel (idx), ms je Detektor-Aufruf (Merkmale + Matching gegen alle Ziele).
import { createRequire } from 'module';
import { readdirSync } from 'fs';
const require = createRequire(process.env.PLAYWRIGHT || '/Users/janoszuberbuhler/.npm/_npx/bc46ece8a1067505/node_modules/');
const { chromium } = require('playwright');
const [MIND, SETS, EXTRA = ''] = process.argv.slice(2);
const PORT = process.env.PORT || 8111;
const F = decodeURIComponent(new URL('../../Fotos/', import.meta.url).pathname);
const ls = (d, re) => readdirSync(F + d).filter((f) => re.test(f)).sort().map((f) => `../../Fotos/${d}${f}`);
const SET = {
  nah2: () => ls('Nahaufnahmen-2/', /\.jpg$/),
  nah: () => ls('Nahaufnahmen/', /\.jpg$/),
  schmuck: () => ls('Geschmueckt/', /\.jpg$/),
  ohne: () => ls('', /^IMG_68(2\d|3\d|40)\.jpeg$/).filter((f) => !f.includes('6834')),
  video: () => ls('Video/frames/', /\.jpg$/),
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const s of SETS.split(',')) {
  const photos = SET[s]();
  const asis = EXTRA.includes('asis') || s === 'video';
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/app/dev/target-bench.html?mind=${MIND}&photos=${photos.join(',')}&${asis ? 'asis=1&' : ''}${EXTRA}`);
  await page.waitForFunction(() => window.bench && window.bench.done, null, { timeout: 0 });
  const b = await page.evaluate(() => window.bench);
  await page.close();
  if (b.error) { console.log(s, 'ERR', b.error); continue; }
  const det = b.rows.reduce((a, r) => a + r.detected, 0), tot = b.rows.reduce((a, r) => a + r.of, 0);
  const idx = b.rows.reduce((a, r) => r.idx.split('/').map((v, i) => +v + (a[i] || 0)), []);
  console.log(JSON.stringify({ satz: s, mind: MIND, opt: (asis ? 'asis ' : '') + EXTRA, erkannt: det, von: tot, idx: idx.join('/'), ms: b.ms, workerFehler: b.workerErrors, proFoto: b.rows.map((r) => r.photo.replace(/\D/g, '').slice(-4) + ':' + r.detected).join(' ') }));
}
await browser.close();
