// Render frames of src/index.html (deterministic, time-driven) to JPEGs.
//   node tools/render.mjs <outDir> --from 0 --to 1139            # frame range @30fps
//   node tools/render.mjs <outDir> --stills 0.5,5,21.5,35        # individual times (seconds) -> still_<t>.jpg
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(path.join(here, '..', 'src', 'index.html')).href;
const args = process.argv.slice(2);
const out = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = 30, DUR = 38;
fs.mkdirSync(out, { recursive: true });

let exe;
for (const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium']) { if (fs.existsSync(c) && fs.statSync(c).isFile()) { exe = c; break; } }
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(page_url);
await page.evaluate(() => window.ready);

const stills = opt('stills');
if (stills) {
  for (const s of stills.split(',')) {
    await page.evaluate(t => window.renderFrame(t), parseFloat(s));
    await page.screenshot({ path: path.join(out, `still_${s}.jpg`), type: 'jpeg', quality: 92 });
  }
} else {
  const from = parseInt(opt('from', '0')), to = parseInt(opt('to', String(FPS * DUR - 1)));
  const t0 = Date.now();
  for (let f = from; f <= to; f++) {
    await page.evaluate(t => window.renderFrame(t), f / FPS);
    await page.screenshot({ path: path.join(out, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
    if ((f - from) % 60 === 0) console.log(`frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
await browser.close();
