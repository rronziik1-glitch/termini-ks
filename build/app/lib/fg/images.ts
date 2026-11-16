// Uploaded photos. The full-quality file stays private in storage/; the preview derivative is at most
// 800px wide, JPEG quality 55, with the watermark composited into the pixels (01-product-design.md §6.3).
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { AppError } from '../db';
import { randomId } from '../config';
import { sq } from '../sq';

export const storageRoot = () => path.join(process.cwd(), 'storage');
export const storagePath = (key: string) => {
  const full = path.resolve(storageRoot(), key);
  if (!full.startsWith(path.resolve(storageRoot()))) throw new Error('bad storage key');
  return full;
};

const WATERMARK = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190">
    <g transform="rotate(-24 150 95)">
      <path d="M-40 128H340" stroke="#fff" stroke-opacity=".38" stroke-width="1.5"/>
      <path d="M-40 131H340" stroke="#000" stroke-opacity=".22" stroke-width="1.5"/>
      <g font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" text-anchor="middle">
        <text x="150" y="100" fill="none" stroke="#000" stroke-opacity=".34" stroke-width="3">Faqja Gati – Preview</text>
        <text x="150" y="100" fill="#fff" fill-opacity=".5">Faqja Gati – Preview</text>
      </g>
    </g>
  </svg>`,
);

export async function saveUpload(pageId: string, data: Buffer): Promise<{ storageKey: string; previewKey: string; width: number; height: number }> {
  const dir = path.join('pages', pageId);
  await fs.mkdir(storagePath(dir), { recursive: true });
  const id = randomId(12);
  const storageKey = path.posix.join('pages', pageId, `${id}.jpg`);
  const previewKey = path.posix.join('pages', pageId, `${id}.preview.jpg`);
  try {
    const full = await sharp(data, { failOn: 'none' }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    await fs.writeFile(storagePath(storageKey), full.data);
    const small = await sharp(full.data).resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).toBuffer();
    const preview = await sharp(small).composite([{ input: WATERMARK, tile: true }]).jpeg({ quality: 55 }).toBuffer();
    await fs.writeFile(storagePath(previewKey), preview);
    return { storageKey, previewKey, width: full.info.width, height: full.info.height };
  } catch {
    throw new AppError('photo_type', 415, sq.errors.photo_type);
  }
}

/** Square photo for a business profile. */
export async function saveBusinessPhoto(businessId: string, data: Buffer): Promise<string> {
  await fs.mkdir(storagePath('biz'), { recursive: true });
  const key = path.posix.join('biz', `${businessId}.jpg`);
  try {
    const out = await sharp(data, { failOn: 'none' }).rotate().resize({ width: 480, height: 480, fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
    await fs.writeFile(storagePath(key), out);
    return key;
  } catch {
    throw new AppError('photo_type', 415, sq.errors.photo_type);
  }
}

export async function readStored(key: string): Promise<Buffer | null> {
  try { return await fs.readFile(storagePath(key)); } catch { return null; }
}

export async function removePageFiles(pageId: string) {
  await fs.rm(storagePath(path.join('pages', pageId)), { recursive: true, force: true });
}
