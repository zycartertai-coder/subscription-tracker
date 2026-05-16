import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const svgPath = resolve(here, 'icon-source.svg');
const outDir = resolve(repoRoot, 'icons');

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

await mkdir(outDir, { recursive: true });
const svg = await readFile(svgPath);
for (const t of targets) {
  const out = resolve(outDir, t.name);
  await sharp(svg).resize(t.size, t.size).png().toFile(out);
  console.log('wrote', t.name);
}
