// Variante einer .mind-Datei kompilieren, ohne app/targets.mind anzufassen (docs/AR.md „Kacheln“).
//   node app/dev/compile-variant.mjs <ausgabe.mind> [query für tools/compile-target.html, z. B. tiles=s0,s1 oder tiles=0]
// Braucht den Server aus tools/compile_server.py (env PORT, 8111). Gibt die Kompilier-Statistik aus.
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire(process.env.PLAYWRIGHT || '/Users/janoszuberbuhler/.npm/_npx/bc46ece8a1067505/node_modules/');
const { chromium } = require('playwright');
const [OUT, QUERY = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(`http://localhost:${process.env.PORT || 8111}/tools/compile-target.html?nosave=1&${QUERY}`);
await page.waitForFunction(() => window.compileStats || /Fehler/.test(document.getElementById('status').textContent), null, { timeout: 0 });
const r = await page.evaluate(() => ({ st: window.compileStats, err: document.getElementById('status').textContent, b: window.mindBuf && Array.from(new Uint8Array(window.mindBuf)) }));
if (!r.st) { console.log(r.err); process.exit(1); }
writeFileSync(OUT, Buffer.from(r.b));
console.log(JSON.stringify({ out: OUT, bytes: r.st.mind_bytes, s: r.st.dauer_s, kacheln: r.st.kacheln }));
await browser.close();
