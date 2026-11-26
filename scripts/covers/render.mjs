/**
 * Renders original editorial cover illustrations for articles.
 * Input:  content/covers.json   Output: assets/covers/<id>.jpg and content/images.json
 * Needs Noto Serif JP / Noto Sans JP .ttf files in FONT_DIR (any folder).
 *   FONT_DIR=/path/to/fonts npm run build:covers
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const covers = JSON.parse(fs.readFileSync(path.join(root, 'content/covers.json'), 'utf8'));
const fontDir = process.env.FONT_DIR;
if (!fontDir) throw new Error('Set FONT_DIR to a folder containing Noto Serif JP and Noto Sans JP .ttf files');
const findFont = (name) => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const f = walk(fontDir).find((p) => p.endsWith(name));
  if (!f) throw new Error(`Font ${name} not found in ${fontDir}`);
  return pathToFileURL(f).href;
};
const fontCss = `
@font-face { font-family: Serif; font-weight: 400; src: url(${findFont('NotoSerifJP_400Regular.ttf')}); }
@font-face { font-family: Serif; font-weight: 700; src: url(${findFont('NotoSerifJP_700Bold.ttf')}); }
@font-face { font-family: Serif; font-weight: 900; src: url(${findFont('NotoSerifJP_900Black.ttf')}); }
@font-face { font-family: Sans; font-weight: 400; src: url(${findFont('NotoSansJP_400Regular.ttf')}); }
@font-face { font-family: Sans; font-weight: 700; src: url(${findFont('NotoSansJP_700Bold.ttf')}); }
`;

const W = 1200;
const H = 750;

const PALETTES = {
  vermilion: { bg: '#E9E2D4', ink: '#1C1B1A', accent: '#C0392B', soft: '#D7CBB5' },
  indigo: { bg: '#1E2A44', ink: '#F3EEE3', accent: '#E0A43A', soft: '#2C3B5C' },
  matcha: { bg: '#DDE3CF', ink: '#1F2A1E', accent: '#5E7D3A', soft: '#C6CFB3' },
  sakura: { bg: '#F4E4E1', ink: '#2A1E22', accent: '#C9566E', soft: '#EACFCB' },
  night: { bg: '#121417', ink: '#F2F0EA', accent: '#E5483B', soft: '#23272D' },
  sea: { bg: '#D6E4E8', ink: '#13252E', accent: '#2C6E8F', soft: '#BCD3DA' },
  ochre: { bg: '#EFE2C6', ink: '#2A2116', accent: '#B5651D', soft: '#E0CDA5' },
  plum: { bg: '#2B1E2E', ink: '#F4EDE6', accent: '#D98AA0', soft: '#3D2C41' },
  paper: { bg: '#F5F2EC', ink: '#161616', accent: '#B3261E', soft: '#E6E0D5' },
};

const grain = `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.07"/></feComponentTransfer></filter><rect width="${W}" height="${H}" filter="url(#grain)"/>`;

function pattern(kind, p) {
  if (kind === 'grid') {
    let s = '';
    for (let x = 0; x <= W; x += 75) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${p.soft}" stroke-width="2"/>`;
    for (let y = 0; y <= H; y += 75) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${p.soft}" stroke-width="2"/>`;
    return s;
  }
  if (kind === 'rings') {
    let s = '';
    for (let r = 80; r < 900; r += 60) s += `<circle cx="${W * 0.72}" cy="${H * 0.5}" r="${r}" fill="none" stroke="${p.soft}" stroke-width="3"/>`;
    return s;
  }
  if (kind === 'lines') {
    let s = '';
    for (let y = 40; y < H; y += 36) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${p.soft}" stroke-width="2"/>`;
    return s;
  }
  if (kind === 'seigaiha') {
    let s = '';
    for (let row = 0; row < 14; row++) {
      for (let col = -1; col < 14; col++) {
        const cx = col * 100 + (row % 2 ? 50 : 0);
        const cy = row * 50 + 380;
        for (let r = 50; r > 5; r -= 12) s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${r % 24 ? p.bg : p.soft}" stroke="${p.soft}" stroke-width="3"/>`;
      }
    }
    return s;
  }
  return '';
}

/** Large typographic cover: one or two characters set like a poster. */
function glyphCover(c, p) {
  const size = c.size ?? (c.glyph.length > 2 ? 300 : c.glyph.length === 2 ? 400 : 520);
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${p.bg}"/>
    ${pattern(c.pattern ?? 'grid', p)}
    <circle cx="${c.sunX ?? 930}" cy="${c.sunY ?? 190}" r="${c.sunR ?? 92}" fill="${p.accent}"/>
    <text x="${c.x ?? 90}" y="${c.y ?? 610}" font-family="Serif" font-weight="900" font-size="${size}" fill="${p.ink}" letter-spacing="-10">${c.glyph}</text>
    ${c.sub ? `<text x="${c.subX ?? 1110}" y="${c.subY ?? 680}" text-anchor="end" font-family="Serif" font-style="italic" font-weight="400" font-size="58" fill="${p.ink}" opacity="0.75">${c.sub}</text>` : ''}
    ${c.mark ? `<rect x="${c.markX}" y="${c.markY}" width="${c.markW}" height="12" fill="${p.accent}"/>` : ''}
    ${grain}
  </svg>`;
}

/** Simple flat scenes drawn from shapes. */
const MOTIFS = {
  mountain: (p) => `
    <circle cx="860" cy="210" r="110" fill="${p.accent}"/>
    <path d="M0 750 L0 560 L260 430 L420 500 L600 250 L700 330 L760 290 L1200 600 L1200 750 Z" fill="${p.soft}"/>
    <path d="M600 250 L700 330 L760 290 L820 330 L700 360 L640 330 L560 360 Z" fill="${p.bg}"/>
    <path d="M0 750 L0 640 L300 560 L560 640 L840 560 L1200 680 L1200 750 Z" fill="${p.ink}" opacity="0.85"/>`,
  wave: (p) => `
    <circle cx="300" cy="200" r="90" fill="${p.accent}"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M0 ${430 + i * 80} Q 150 ${380 + i * 80} 300 ${430 + i * 80} T 600 ${430 + i * 80} T 900 ${430 + i * 80} T 1200 ${430 + i * 80} L1200 750 L0 750 Z" fill="${i % 2 ? p.soft : p.ink}" opacity="${0.45 + i * 0.15}"/>`).join('')}`,
  train: (p) => `
    <rect x="0" y="520" width="1200" height="14" fill="${p.ink}"/>
    <rect x="0" y="560" width="1200" height="8" fill="${p.ink}" opacity="0.6"/>
    <path d="M140 520 L140 360 Q140 300 200 300 L880 300 Q1040 300 1120 420 L1150 520 Z" fill="${p.bg}" stroke="${p.ink}" stroke-width="8"/>
    <rect x="140" y="440" width="1000" height="22" fill="${p.accent}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${200 + i * 150}" y="335" width="110" height="70" rx="10" fill="${p.ink}" opacity="0.85"/>`).join('')}
    <path d="M960 335 L1040 335 Q1080 360 1095 405 L960 405 Z" fill="${p.ink}" opacity="0.85"/>
    <circle cx="960" cy="200" r="70" fill="${p.accent}" opacity="0.9"/>`,
  bowl: (p) => `
    <circle cx="600" cy="300" r="260" fill="${p.soft}"/>
    <path d="M300 380 L900 380 Q890 600 600 620 Q310 600 300 380 Z" fill="${p.accent}"/>
    <rect x="300" y="365" width="600" height="26" rx="13" fill="${p.ink}"/>
    <path d="M380 365 Q480 300 560 360 Q640 300 720 360 Q800 310 840 365 Z" fill="${p.bg}" opacity="0.9"/>
    <rect x="540" y="620" width="120" height="30" rx="6" fill="${p.ink}"/>
    <line x1="700" y1="120" x2="980" y2="330" stroke="${p.ink}" stroke-width="16" stroke-linecap="round"/>
    <line x1="740" y1="100" x2="1010" y2="320" stroke="${p.ink}" stroke-width="16" stroke-linecap="round"/>`,
  lantern: (p) => `
    ${[260, 600, 940].map((x, i) => `
      <line x1="${x}" y1="0" x2="${x}" y2="${150 + i * 30}" stroke="${p.ink}" stroke-width="6"/>
      <rect x="${x - 50}" y="${150 + i * 30}" width="100" height="24" rx="6" fill="${p.ink}"/>
      <ellipse cx="${x}" cy="${330 + i * 30}" rx="130" ry="170" fill="${p.accent}"/>
      ${[-100, -50, 0, 50, 100].map((d) => `<line x1="${x - 125}" y1="${330 + i * 30 + d}" x2="${x + 125}" y2="${330 + i * 30 + d}" stroke="${p.ink}" stroke-width="3" opacity="0.35"/>`).join('')}
      <rect x="${x - 50}" y="${490 + i * 30}" width="100" height="24" rx="6" fill="${p.ink}"/>`).join('')}`,
  blossom: (p) => {
    const flower = (x, y, r) => [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - r}" rx="${r * 0.55}" ry="${r}" fill="${p.accent}" opacity="0.85" transform="rotate(${a} ${x} ${y})"/>`).join('') + `<circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="${p.bg}"/>`;
    return `<path d="M0 640 Q 300 520 520 560 T 1200 300" stroke="${p.ink}" stroke-width="26" fill="none"/>
      <path d="M520 560 Q 620 460 760 470" stroke="${p.ink}" stroke-width="14" fill="none"/>
      ${flower(330, 500, 60)}${flower(640, 470, 48)}${flower(800, 440, 70)}${flower(1020, 330, 56)}${flower(180, 610, 40)}${flower(920, 560, 36)}`;
  },
  city: (p) => `
    <circle cx="300" cy="180" r="80" fill="${p.accent}"/>
    ${[[40, 300, 160], [210, 200, 120], [340, 360, 140], [490, 140, 170], [670, 260, 120], [800, 90, 150], [960, 320, 200]].map(([x, h, w]) => `<rect x="${x}" y="${H - 120 - h}" width="${w}" height="${h + 120}" fill="${p.soft}"/>${Array.from({ length: Math.floor(h / 50) }, (_, r) => Array.from({ length: Math.floor(w / 40) }, (_, c) => `<rect x="${x + 14 + c * 40}" y="${H - 100 - h + r * 50}" width="18" height="24" fill="${(r + c + x) % 3 ? p.bg : p.accent}" opacity="0.9"/>`).join('')).join('')}`).join('')}
    <rect x="0" y="${H - 60}" width="${W}" height="60" fill="${p.ink}"/>`,
  shop: (p) => `
    <rect x="160" y="180" width="880" height="470" fill="${p.bg}" stroke="${p.ink}" stroke-width="8"/>
    <rect x="160" y="180" width="880" height="90" fill="${p.ink}"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${160 + i * 110}" y="270" width="110" height="50" fill="${i % 2 ? p.accent : p.bg}"/>`).join('')}
    <rect x="220" y="360" width="340" height="290" fill="${p.soft}" stroke="${p.ink}" stroke-width="6"/>
    <rect x="640" y="360" width="340" height="230" fill="${p.soft}" stroke="${p.ink}" stroke-width="6"/>
    ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${660 + c * 80}" y="${380 + r * 70}" width="60" height="46" rx="6" fill="${(r + c) % 2 ? p.accent : p.ink}" opacity="0.8"/>`).join('')).join('')}
    <circle cx="530" cy="510" r="10" fill="${p.ink}"/>`,
  tea: (p) => `
    <circle cx="600" cy="390" r="300" fill="${p.soft}"/>
    <path d="M380 330 L820 330 Q820 560 600 580 Q380 560 380 330 Z" fill="${p.ink}"/>
    <ellipse cx="600" cy="330" rx="220" ry="40" fill="${p.accent}"/>
    <path d="M520 250 Q500 200 540 160 M600 250 Q580 190 620 140 M680 250 Q660 200 700 160" stroke="${p.ink}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.5"/>
    <rect x="500" y="580" width="200" height="22" rx="8" fill="${p.ink}"/>`,
  torii: (p) => `
    <circle cx="600" cy="300" r="190" fill="${p.soft}"/>
    <rect x="0" y="600" width="${W}" height="150" fill="${p.ink}" opacity="0.15"/>
    <path d="M250 170 Q600 120 950 170 L960 210 Q600 170 240 210 Z" fill="${p.accent}"/>
    <rect x="300" y="250" width="600" height="34" fill="${p.accent}"/>
    <rect x="360" y="200" width="44" height="420" fill="${p.accent}"/>
    <rect x="796" y="200" width="44" height="420" fill="${p.accent}"/>
    <rect x="580" y="210" width="40" height="40" fill="${p.ink}"/>`,
  speech: (p) => `
    <rect x="140" y="150" width="560" height="300" rx="40" fill="${p.accent}"/>
    <path d="M260 440 L240 540 L360 450 Z" fill="${p.accent}"/>
    <rect x="520" y="330" width="560" height="280" rx="40" fill="${p.ink}"/>
    <path d="M960 600 L1000 690 L880 610 Z" fill="${p.ink}"/>
    ${[0, 1, 2].map((i) => `<rect x="200" y="${220 + i * 60}" width="${420 - i * 90}" height="22" rx="11" fill="${p.bg}" opacity="0.85"/>`).join('')}
    ${[0, 1, 2].map((i) => `<rect x="580" y="${400 + i * 60}" width="${440 - i * 120}" height="22" rx="11" fill="${p.bg}" opacity="0.7"/>`).join('')}`,
  calendar: (p) => `
    <rect x="300" y="140" width="600" height="500" fill="${p.bg}" stroke="${p.ink}" stroke-width="8"/>
    <rect x="300" y="140" width="600" height="110" fill="${p.accent}"/>
    <circle cx="420" cy="140" r="18" fill="${p.ink}"/><circle cx="780" cy="140" r="18" fill="${p.ink}"/>
    ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 7 }, (_, c) => `<rect x="${330 + c * 80}" y="${280 + r * 70}" width="56" height="44" fill="${r === 2 && c === 4 ? p.accent : p.soft}"/>`).join('')).join('')}`,
};

function motifCover(c, p) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${p.bg}"/>
    ${c.pattern ? pattern(c.pattern, p) : ''}
    ${MOTIFS[c.motif](p)}
    ${c.glyph ? `<text x="${c.x ?? 70}" y="${c.y ?? 140}" font-family="Serif" font-weight="900" font-size="${c.size ?? 110}" fill="${p.ink}">${c.glyph}</text>` : ''}
    ${grain}
  </svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const outDir = path.join(root, 'assets/covers');
fs.mkdirSync(outDir, { recursive: true });
const images = [];
for (const c of covers) {
  const p = PALETTES[c.palette];
  if (!p) throw new Error(`${c.id}: unknown palette ${c.palette}`);
  if (c.motif && !MOTIFS[c.motif]) throw new Error(`${c.id}: unknown motif ${c.motif}`);
  const svg = c.motif ? motifCover(c, p) : glyphCover(c, p);
  await page.setContent(`<html><head><style>${fontCss} html,body{margin:0}</style></head><body>${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const file = `assets/covers/${c.id}.jpg`;
  await page.screenshot({ path: path.join(root, file), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: W, height: H } });
  images.push({ id: c.id, file, width: W, height: H, alt: c.alt, credit: '日本語 Daily illustration', licence: 'Original artwork' });
}
await browser.close();
fs.writeFileSync(path.join(root, 'content/images.json'), JSON.stringify(images, null, 2) + '\n');
console.log(`Rendered ${images.length} covers.`);
