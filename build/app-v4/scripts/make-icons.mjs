// One-off: renders public/icon.svg to the PNG sizes the PWA manifest needs. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
import { at } from './lib.mjs';

for (const size of [192, 512]) {
  await sharp(at('public', 'icon.svg'), { density: 300 }).resize(size, size).png().toFile(at('public', `icon-${size}.png`));
  console.log(`public/icon-${size}.png`);
}
