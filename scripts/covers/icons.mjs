/**
 * Renders the app icon, adaptive icon layers, splash mark and favicon.
 *   FONT_DIR=/path/to/fonts node scripts/covers/icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fontDir = process.env.FONT_DIR;
if (!fontDir) throw new Error('Set FONT_DIR to a folder containing Noto Serif JP .ttf files');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const font = pathToFileURL(walk(fontDir).find((p) => p.endsWith('NotoSerifJP_900Black.ttf'))).href;

const SAFFRON = '#F4C430';
const INK = '#141414';

/** The mark: a heavy 日 (day, as in daily). scale = share of the canvas it fills. */
const mark = (size, color, scale) => {
  const g = size * scale;
  return `<div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div style="font-family:Mark;font-weight:900;font-size:${g}px;line-height:1;color:${color};-webkit-text-stroke:${g * 0.025}px ${color};margin-top:-${g * 0.04}px">日</div>
  </div>`;
};

const jobs = [
  { file: 'icon.png', size: 1024, bg: SAFFRON, body: mark(1024, INK, 0.52) },
  { file: 'android-icon-background.png', size: 1024, bg: SAFFRON, body: '' },
  { file: 'android-icon-foreground.png', size: 1024, bg: 'transparent', body: mark(1024, INK, 0.36) },
  { file: 'android-icon-monochrome.png', size: 1024, bg: 'transparent', body: mark(1024, '#FFFFFF', 0.36) },
  { file: 'splash-icon.png', size: 512, bg: 'transparent', body: `<div style="position:absolute;inset:0;border-radius:22%;background:${SAFFRON}"></div>${mark(512, INK, 0.52)}` },
  { file: 'favicon.png', size: 64, bg: SAFFRON, body: mark(64, INK, 0.6) },
];

const browser = await chromium.launch();
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.size, height: j.size } });
  await page.setContent(`<html><head><style>@font-face{font-family:Mark;font-weight:900;src:url(${font})} html,body{margin:0;background:transparent}</style></head>
    <body><div style="position:relative;width:${j.size}px;height:${j.size}px;background:${j.bg}">${j.body}</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'assets/images', j.file), omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
  await page.close();
}
await browser.close();
console.log(`Rendered ${jobs.length} icons.`);
