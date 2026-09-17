// Copies web-root static files that Vite does not bundle into dist/.
// Needed because vite.config uses root='public', so there is no separate
// publicDir: sw.js, PWA icons/manifest and docs/cv.txt (AI knowledge base
// fetched at runtime by src/chat.js) would otherwise 404 in production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const pub = path.join(root, 'public');
const dist = path.join(root, 'dist');

const FILES = [
  'sw.js',
  'manifest.json',
  'favicon.svg',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
];
const DIRS = ['docs'];

let copied = 0;
for (const f of FILES) {
  const src = path.join(pub, f), dst = path.join(dist, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    copied++;
  } else {
    console.warn(`[copy-static] missing: public/${f}`);
  }
}
for (const d of DIRS) {
  const src = path.join(pub, d), dst = path.join(dist, d);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-static] missing dir: public/${d}`);
    continue;
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  copied++;
}
console.log(`[copy-static] ${copied} entries copied to dist/`);
