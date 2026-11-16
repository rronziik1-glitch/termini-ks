// File storage for uploaded photos. One small interface, four drivers, chosen by STORAGE_DRIVER:
//   local        files in ./storage (development; does NOT work on Vercel, its disk is read-only and temporary)
//   vercel-blob  Vercel Blob            (BLOB_READ_WRITE_TOKEN)
//   supabase     Supabase Storage       (SUPABASE_URL, SUPABASE_SERVICE_KEY, STORAGE_BUCKET)
//   s3           any S3-compatible API  (S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)
//                e.g. Cloudflare R2, Backblaze B2, AWS S3
// The files are never linked to directly: photos are always served through our own routes
// (/faqja/{id}/img/…, /p/{slug}/img/…), which decide who may see the full-quality version.
// Keys look like "pages/{pageId}/{id}.jpg" and "biz/{businessId}.jpg".
//
// NOTE: only the local driver has been run on this machine. The three cloud drivers follow the providers'
// documented APIs but need one real upload to confirm (GO-ONLINE.md, step "Storage").
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from './log';

export interface StorageDriver {
  id: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** Deletes every file whose key starts with the prefix (a "folder"). */
  removePrefix(prefix: string): Promise<void>;
}

const env = (k: string, d = '') => (process.env[k] ?? d).trim();
export const STORAGE_DRIVERS = ['local', 'vercel-blob', 'supabase', 's3'] as const;
export type StorageDriverId = (typeof STORAGE_DRIVERS)[number];
export const storageDriverId = (): StorageDriverId => {
  const v = env('STORAGE_DRIVER', 'local').toLowerCase();
  return (STORAGE_DRIVERS as readonly string[]).includes(v) ? (v as StorageDriverId) : 'local';
};

const cleanKey = (key: string) => {
  const k = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!k || k.split('/').some((p) => p === '..' || p === '.' || p === '')) throw new Error('bad storage key');
  return k;
};
const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

/* ---- local ------------------------------------------------------------------ */
export const storageRoot = () => path.join(process.cwd(), 'storage');
const localPath = (key: string) => {
  const full = path.resolve(storageRoot(), key);
  if (!full.startsWith(path.resolve(storageRoot()))) throw new Error('bad storage key');
  return full;
};
const local: StorageDriver = {
  id: 'local',
  async put(key, data) {
    await fs.mkdir(path.dirname(localPath(key)), { recursive: true });
    await fs.writeFile(localPath(key), data);
  },
  async get(key) {
    try { return await fs.readFile(localPath(key)); } catch { return null; }
  },
  async removePrefix(prefix) {
    await fs.rm(localPath(prefix), { recursive: true, force: true });
  },
};

/* ---- Vercel Blob ---------------------------------------------------------------- */
// Blobs are created with fixed names (no random suffix), so a key always maps to the same blob.
// "public" is the only access mode of Vercel Blob; the URLs contain the store id plus our random file ids
// and are never sent to a browser.
type BlobSdk = typeof import('@vercel/blob');
const blobSdk = (): Promise<BlobSdk> => import('@vercel/blob');
const blobToken = () => env('BLOB_READ_WRITE_TOKEN');
const vercelBlob: StorageDriver = {
  id: 'vercel-blob',
  async put(key, data, contentType) {
    const { put } = await blobSdk();
    await put(key, data, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType, token: blobToken() });
  },
  async get(key) {
    const { head } = await blobSdk();
    try {
      const meta = await head(key, { token: blobToken() });
      const res = await fetch(meta.url, { cache: 'no-store' });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    } catch { return null; }
  },
  async removePrefix(prefix) {
    const { list, del } = await blobSdk();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, token: blobToken() });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url), { token: blobToken() });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  },
};

/* ---- Supabase Storage (REST) --------------------------------------------------------- */
// Use a PRIVATE bucket and the service_role key (server only, never in the browser).
const supa = () => ({ url: env('SUPABASE_URL').replace(/\/$/, ''), key: env('SUPABASE_SERVICE_KEY'), bucket: env('STORAGE_BUCKET', 'faqja-gati') });
const supaHeaders = () => ({ authorization: `Bearer ${supa().key}`, apikey: supa().key });
const supabase: StorageDriver = {
  id: 'supabase',
  async put(key, data, contentType) {
    const s = supa();
    const res = await fetch(`${s.url}/storage/v1/object/${s.bucket}/${encodeKey(key)}`, {
      method: 'POST', headers: { ...supaHeaders(), 'content-type': contentType, 'x-upsert': 'true' }, body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`supabase storage put ${res.status}: ${(await res.text()).slice(0, 200)}`);
  },
  async get(key) {
    const s = supa();
    const res = await fetch(`${s.url}/storage/v1/object/${s.bucket}/${encodeKey(key)}`, { headers: supaHeaders(), cache: 'no-store' });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  },
  async removePrefix(prefix) {
    const s = supa();
    const list = await fetch(`${s.url}/storage/v1/object/list/${s.bucket}`, {
      method: 'POST', headers: { ...supaHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000 }),
    });
    if (!list.ok) throw new Error(`supabase storage list ${list.status}`);
    const names = ((await list.json()) as { name: string }[]).map((f) => `${prefix.replace(/\/$/, '')}/${f.name}`);
    if (!names.length) return;
    const res = await fetch(`${s.url}/storage/v1/object/${s.bucket}`, {
      method: 'DELETE', headers: { ...supaHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: names }),
    });
    if (!res.ok) throw new Error(`supabase storage delete ${res.status}`);
  },
};

/* ---- S3-compatible (AWS Signature Version 4, path-style URLs) --------------------------- */
const sha256hex = (d: string | Buffer) => createHash('sha256').update(d).digest('hex');
const hmac = (key: string | Buffer, d: string) => createHmac('sha256', key).update(d).digest();
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export type S3Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
const s3Config = (): S3Config => ({
  endpoint: env('S3_ENDPOINT').replace(/\/$/, ''), region: env('S3_REGION', 'auto'), bucket: env('S3_BUCKET'),
  accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
});

/** Builds a signed request. Exported for the test (checked against the example in the AWS documentation). */
export function signS3(cfg: S3Config, method: string, urlPath: string, query: Record<string, string>, body: Buffer | '', extraHeaders: Record<string, string> = {}, now = new Date()) {
  const host = new URL(cfg.endpoint).host;
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const headers: Record<string, string> = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...extraHeaders };
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonicalQuery = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`).join('&');
  const canonical = [method, urlPath, canonicalQuery, names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${cfg.region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + cfg.secretAccessKey, day), cfg.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const { host: _h, ...send } = lower;
  return { url: `${cfg.endpoint}${urlPath}${canonicalQuery ? '?' + canonicalQuery : ''}`, headers: { ...send, authorization }, signature };
}

async function s3Fetch(method: string, key: string, query: Record<string, string> = {}, body: Buffer | '' = '', extra: Record<string, string> = {}) {
  const cfg = s3Config();
  const urlPath = `/${cfg.bucket}${key ? '/' + key.split('/').map(rfc3986).join('/') : ''}`;
  const req = signS3(cfg, method, urlPath, query, body, extra);
  return fetch(req.url, { method, headers: req.headers, body: body === '' ? undefined : new Uint8Array(body), cache: 'no-store' });
}
const s3: StorageDriver = {
  id: 's3',
  async put(key, data, contentType) {
    const res = await s3Fetch('PUT', key, {}, data, { 'content-type': contentType });
    if (!res.ok) throw new Error(`s3 put ${res.status}: ${(await res.text()).slice(0, 200)}`);
  },
  async get(key) {
    const res = await s3Fetch('GET', key);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  },
  async removePrefix(prefix) {
    const res = await s3Fetch('GET', '', { 'list-type': '2', prefix });
    if (!res.ok) throw new Error(`s3 list ${res.status}`);
    const keys = [...(await res.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    for (const k of keys) await s3Fetch('DELETE', k);
  },
};

/* ---- public API ----------------------------------------------------------------- */
const DRIVERS: Record<StorageDriverId, StorageDriver> = { local, 'vercel-blob': vercelBlob, supabase, s3 };
export const storage = (): StorageDriver => DRIVERS[storageDriverId()];

export async function putFile(key: string, data: Buffer, contentType = 'image/jpeg') {
  try { await storage().put(cleanKey(key), data, contentType); }
  catch (e) { log.error('storage.put_failed', { driver: storageDriverId(), key, error: String(e) }); throw e; }
}
export async function getFile(key: string): Promise<Buffer | null> {
  try { return await storage().get(cleanKey(key)); }
  catch (e) { log.error('storage.get_failed', { driver: storageDriverId(), key, error: String(e) }); return null; }
}
export async function removeFiles(prefix: string) {
  try { await storage().removePrefix(cleanKey(prefix)); }
  catch (e) { log.error('storage.remove_failed', { driver: storageDriverId(), prefix, error: String(e) }); }
}
