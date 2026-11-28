// v7 unclaimed listings: real businesses that are not on Termini yet, so the public lists are never empty.
// Public facts only (name, type, city, address, phone, position), from OpenStreetMap (ODbL, credited on every page
// that shows them) or typed in by the admin. A listing never pretends to take bookings: it shows "Ende jo në Termini",
// Call / WhatsApp, "Dua të rezervoj këtu" (demand we show to the business) and "Merre falas" (claim).
import fs from 'node:fs';
import path from 'node:path';
import type { Listing, Prisma } from '@prisma/client';
import { ipHash } from './config';
import { AppError, db } from './db';
import { normalizePhone } from './phone';
import { rateLimitDb } from './ratelimit';
import { fold, searchWords } from './search';
import { slugify } from './slug';
import { sq } from './sq';

export const LISTING_CATEGORIES = ['berber', 'salon', 'dentist', 'klinike', 'bujtine', 'restorant', 'dyqan', 'dasma', 'autoshkolla', 'lavazh', 'tjeter'];
export type PublicListing = Pick<Listing, 'slug' | 'name' | 'category' | 'city' | 'address' | 'requestsCount'> & { hasPhone: boolean };

const pub = (l: Listing): PublicListing => ({ slug: l.slug, name: l.name, category: l.category, city: l.city, address: l.address, requestsCount: l.requestsCount, hasPhone: !!l.phone });

/** Active listings for "Gjej" and the home page: same city / type filters and the same search words as businesses. */
export async function findListings(opts: { city?: string; category?: string; q?: string; take?: number } = {}): Promise<PublicListing[]> {
  const words = searchWords(opts.q || '');
  const rows = await db.listing.findMany({
    where: { status: 'active', ...(opts.city ? { city: opts.city } : {}), ...(opts.category ? { category: opts.category } : {}) },
    orderBy: [{ requestsCount: 'desc' }, { name: 'asc' }],
    take: words.length ? 2000 : (opts.take ?? 60),
  });
  const match = (l: Listing) => {
    if (!words.length) return true;
    const hay = fold([l.name, l.city, l.address, sq.categories[l.category], sq.categoriesShort[l.category], sq.categoriesFor[l.category], l.category].filter(Boolean).join(' '));
    return words.every((w) => hay.includes(w));
  };
  return rows.filter(match).slice(0, opts.take ?? 60).map(pub);
}

export async function listingBySlug(slug: string) {
  const l = await db.listing.findUnique({ where: { slug } });
  return l && l.status === 'active' ? l : null;
}

/** "Dua të rezervoj këtu": a customer leaves a name + number. Counted for the business (shown to the admin). */
export async function addListingRequest(slug: string, input: { name?: string; phone?: string; note?: string; website?: string }, ip = 'local') {
  if (input.website) throw new AppError('bad_request', 400, sq.errors.bad_request);              // honeypot
  const l = await listingBySlug(slug);
  if (!l) throw new AppError('not_found', 404, sq.errors.not_found);
  const name = (input.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (name.length < 2) throw new AppError('name_required', 422, sq.errors.name_required);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
  const iph = ipHash(ip);
  if (!(await rateLimitDb(`lreq:${iph}`, 10, 3600e3))) throw new AppError('rate_limited', 429, sq.errors.rate_limited);
  // One person counts once per listing per week (the same number tapping twice is not "2 clients").
  const recent = await db.listingRequest.findFirst({ where: { listingId: l.id, phone, createdAt: { gt: new Date(Date.now() - 7 * 864e5) } } });
  if (recent) return { counted: false };
  await db.$transaction([
    db.listingRequest.create({ data: { listingId: l.id, name, phone, note: (input.note || '').trim().slice(0, 200), ipHash: iph } }),
    db.listing.update({ where: { id: l.id }, data: { requestsCount: { increment: 1 }, lastRequestAt: new Date() } }),
  ]);
  return { counted: true };
}

/** When a business is created from a listing ("Merre falas"): the listing disappears from the public at once when the
 *  verified login phone is the listing's own phone. Otherwise it stays public and the admin sees a claim to check,
 *  so nobody can take over a competitor's listing. Returns true when it was linked. */
export async function claimListing(tx: Prisma.TransactionClient, slug: string, businessId: string, verifiedPhone: string): Promise<boolean> {
  const l = await tx.listing.findUnique({ where: { slug } });
  if (!l || l.status !== 'active') return false;
  if (l.phone && l.phone === verifiedPhone) {
    await tx.listing.update({ where: { id: l.id }, data: { status: 'claimed', claimedBusinessId: businessId } });
    await tx.business.update({ where: { id: businessId }, data: { listingId: l.id } });
    return true;
  }
  await tx.listing.update({ where: { id: l.id }, data: { claimRequestPhone: verifiedPhone } });
  return false;
}

/* ---- import (seed + admin CSV) ------------------------------------------------------------------------------------- */
export type ListingInput = { sourceId?: string | null; name: string; category: string; city: string; address?: string; phone?: string; lat?: number | null; lng?: number | null; slug?: string; source?: string };

async function freeListingSlug(base: string, client: Prisma.TransactionClient | typeof db = db) {
  const b = slugify(base) || 'biznes';
  for (let n = 1; n < 200; n++) {
    const s = n === 1 ? b : `${b.slice(0, 36)}-${n}`;
    const [l, biz] = await Promise.all([client.listing.findUnique({ where: { slug: s } }), client.business.findUnique({ where: { slug: s } })]);
    if (!l && !biz) return s;
  }
  return `${b.slice(0, 30)}-${Date.now().toString(36)}`;
}

/** Adds or refreshes listings. Rows with a sourceId are matched on it (re-running never duplicates); removed or claimed
 *  listings are never brought back. Returns how many new ones were added. */
export async function importListings(rows: ListingInput[]): Promise<number> {
  let added = 0;
  for (const r of rows) {
    const name = (r.name || '').trim().slice(0, 60);
    const city = (r.city || '').trim().slice(0, 40);
    if (name.length < 2 || !city) continue;
    const category = LISTING_CATEGORIES.includes(r.category) ? r.category : 'tjeter';
    const phone = r.phone ? normalizePhone(r.phone) || '' : '';
    const data = { name, category, city, address: (r.address || '').trim().slice(0, 120), phone, lat: r.lat ?? null, lng: r.lng ?? null };
    if (r.sourceId) {
      const old = await db.listing.findUnique({ where: { sourceId: r.sourceId } });
      if (old) { if (old.status === 'active') await db.listing.update({ where: { id: old.id }, data }); continue; }
    } else if (await db.listing.findFirst({ where: { name, city } })) continue;
    // A business that is already on Termini with the same phone is never listed again as "not on Termini".
    if (phone && (await db.business.findFirst({ where: { phone }, select: { id: true } }))) continue;
    const slug = r.slug && !(await db.listing.findUnique({ where: { slug: r.slug } })) && !(await db.business.findUnique({ where: { slug: r.slug } }))
      ? r.slug : await freeListingSlug(`${name} ${city}`);
    await db.listing.create({ data: { ...data, slug, source: r.source || (r.sourceId ? 'osm' : 'manual'), sourceId: r.sourceId || null } });
    added++;
  }
  return added;
}

/** "emri; lloji; qyteti; adresa; telefoni" lines (comma or semicolon). The type may be the Albanian word or the id. */
export function parseListingCsv(text: string): ListingInput[] {
  const byLabel = new Map<string, string>();
  for (const id of LISTING_CATEGORIES) { byLabel.set(fold(id), id); byLabel.set(fold(sq.categories[id] || id), id); byLabel.set(fold(sq.categoriesShort[id] || id), id); }
  return text.split(/\r?\n/).map((line) => line.trim()).filter((l) => l && !/^emri\b/i.test(l)).map((line) => {
    const p = line.split(line.includes(';') ? ';' : ',').map((x) => x.trim());
    return { name: p[0] || '', category: byLabel.get(fold(p[1] || '')) || 'tjeter', city: p[2] || '', address: p[3] || '', phone: p[4] || '' };
  });
}

/** The bundled OpenStreetMap file (scripts/data/listings-kosovo.json, best first). */
export function bundledListings(limit = Number(process.env.LISTINGS_LIMIT) || 100): ListingInput[] {
  const file = path.join(process.cwd(), 'scripts', 'data', 'listings-kosovo.json');
  if (!fs.existsSync(file)) return [];
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as ListingInput[];
  return rows.slice(0, limit).map((r) => ({ ...r, source: 'osm' }));
}
