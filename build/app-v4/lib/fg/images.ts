// Uploaded photos. The full-quality file stays private in storage; the preview derivative is at most
// 800px wide, JPEG quality 55, with the watermark composited into the pixels (01-product-design.md §6.3).
// Where the files live is decided by lib/storage.ts (local folder in dev, cloud storage in production).
import path from 'node:path';
import sharp from 'sharp';
import { AppError } from '../db';
import { randomId } from '../config';
import { getFile, putFile, removeFiles } from '../storage';
import { sq } from '../sq';

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

const PHOTO_FORMATS = ['jpeg', 'png', 'webp', 'avif', 'heif', 'gif', 'tiff'];
/** v4 audit: sharp can also read SVG and other document formats; only photo formats are accepted. */
async function assertPhoto(data: Buffer) {
  let format: string | undefined;
  try { format = (await sharp(data, { failOn: 'none' }).metadata()).format; } catch { format = undefined; }
  if (!format || !PHOTO_FORMATS.includes(format)) throw new AppError('photo_type', 415, sq.errors.photo_type);
}

export async function saveUpload(pageId: string, data: Buffer): Promise<{ storageKey: string; previewKey: string; width: number; height: number }> {
  const id = randomId(12);
  const storageKey = path.posix.join('pages', pageId, `${id}.jpg`);
  const previewKey = path.posix.join('pages', pageId, `${id}.preview.jpg`);
  let full: { data: Buffer; info: sharp.OutputInfo };
  let preview: Buffer;
  await assertPhoto(data);
  try {
    full = await sharp(data, { failOn: 'none' }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    const small = await sharp(full.data).resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).toBuffer();
    preview = await sharp(small).composite([{ input: WATERMARK, tile: true }]).jpeg({ quality: 55 }).toBuffer();
  } catch {
    throw new AppError('photo_type', 415, sq.errors.photo_type);
  }
  try {
    await putFile(storageKey, full.data);
    await putFile(previewKey, preview);
  } catch {
    throw new AppError('storage_failed', 503, sq.errors.storage_failed);
  }
  return { storageKey, previewKey, width: full.info.width, height: full.info.height };
}

/** Square photo for a business profile. */
export async function saveBusinessPhoto(businessId: string, data: Buffer): Promise<string> {
  const key = path.posix.join('biz', `${businessId}.jpg`);
  let out: Buffer;
  await assertPhoto(data);
  try {
    out = await sharp(data, { failOn: 'none' }).rotate().resize({ width: 480, height: 480, fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    throw new AppError('photo_type', 415, sq.errors.photo_type);
  }
  try { await putFile(key, out); } catch { throw new AppError('storage_failed', 503, sq.errors.storage_failed); }
  return key;
}

export const readStored = (key: string): Promise<Buffer | null> => getFile(key);

export async function removePageFiles(pageId: string) {
  await removeFiles(path.posix.join('pages', pageId));
}
