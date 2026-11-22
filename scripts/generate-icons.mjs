// Gera os PNG do manifest a partir dos SVG em public/icons. Uso: npm run icons
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
];

for (const [src, out, size] of jobs) {
  const svg = await readFile(dir + src);
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(dir + out);
  console.log(`✓ ${out} (${size}px)`);
}
