import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const logo = await readFile(resolve(import.meta.dirname, '../public/bvl-logo.svg'));
for (const size of [180, 192, 512]) {
  const mark = await sharp(logo, { density: 300 })
    .resize({ width: Math.round(size * 0.73), height: Math.round(size * 0.73), fit: 'contain', background: '#ffffff' })
    .png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(resolve(import.meta.dirname, `../public/icons/icon-${size}.png`));
}
console.log('PWA icon assets generated from the provided BvL logo. Brand approval is required before launch.');
