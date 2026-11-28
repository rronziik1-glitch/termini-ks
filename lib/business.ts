// Business set-up: onboarding, weekly hours document, slug checks, the "find" list.
import type { Business, User, WorkingHours } from '@prisma/client';
import { searchScore, searchWords } from './search';
import { AppError, db } from './db';
import { freeStarts, isClosed, loadCtx } from './availability';
import { normalizePhone } from './phone';
import { presetFor } from './presets';
import { claimListing } from './listings';
import { freeSlug, isValidSlug, slugify } from './slug';
import { sq } from './sq';
import { addDays, hmToMin, isTime, toLocal } from './time';

export const CATEGORIES = ['berber', 'salon', 'dentist', 'klinike', 'bujtine', 'restorant', 'dyqan', 'dasma', 'autoshkolla', 'lavazh', 'tjeter'];

/* ---- weekly hours ----------------------------------------------------------- */
export type HoursDay = { weekday: number; open: boolean; start: string; end: string };
export type HoursDoc = { days: HoursDay[]; pause: { on: boolean; start: string; end: string } };

export function defaultHours(category: string): HoursDoc {
  const preset = presetFor(category).hours;
  return {
    days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const p = preset.find((h) => h.weekday === weekday);
      return { weekday, open: !!p, start: p?.start || '09:00', end: p?.end || '14:00' };
    }),
    pause: { on: false, start: '13:00', end: '13:30' },
  };
}

/** Rows of working_hours → the editable document. A day with two rows has a pause. */
export function rowsToHours(rows: Pick<WorkingHours, 'weekday' | 'startLocal' | 'endLocal' | 'staffId'>[]): HoursDoc {
  const doc: HoursDoc = { days: [], pause: { on: false, start: '13:00', end: '13:30' } };
  for (let weekday = 1; weekday <= 7; weekday++) {
    const day = rows.filter((r) => r.weekday === weekday && !r.staffId).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
    if (!day.length) { doc.days.push({ weekday, open: false, start: '09:00', end: '14:00' }); continue; }
    doc.days.push({ weekday, open: true, start: day[0].startLocal, end: day[day.length - 1].endLocal });
    if (day.length > 1 && !doc.pause.on) doc.pause = { on: true, start: day[0].endLocal, end: day[1].startLocal };
  }
  return doc;
}

/** The document → rows. The pause splits every open day it falls inside. */
export function hoursToRows(doc: HoursDoc): { weekday: number; startLocal: string; endLocal: string }[] {
  const out: { weekday: number; startLocal: string; endLocal: string }[] = [];
  const p = doc.pause;
  const pauseOk = !!p?.on && isTime(p.start) && isTime(p.end) && hmToMin(p.end) > hmToMin(p.start);
  for (const d of doc.days || []) {
    if (!d.open) continue;
    if (!Number.isInteger(d.weekday) || d.weekday < 1 || d.weekday > 7 || !isTime(d.start) || !isTime(d.end)) throw new AppError('bad_request', 400, sq.errors.bad_request);
    if (hmToMin(d.end) <= hmToMin(d.start)) throw new AppError('hours_order', 422, sq.errors.hours_order);
    if (pauseOk && hmToMin(p.start) > hmToMin(d.start) && hmToMin(p.end) < hmToMin(d.end)) {
      out.push({ weekday: d.weekday, startLocal: d.start, endLocal: p.start }, { weekday: d.weekday, startLocal: p.end, endLocal: d.end });
    } else out.push({ weekday: d.weekday, startLocal: d.start, endLocal: d.end });
  }
  return out;
}

/* ---- services input ----------------------------------------------------------- */
export type ServiceInput = { name?: string; durationMin?: number | string; price?: number | string | null; priceFrom?: boolean; description?: string; active?: boolean };

/** "5" → 500, "12,50" → 1250, "" → null */
export function parsePrice(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s|€/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (!isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100);
}

export function cleanService(s: ServiceInput) {
  const name = (s.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 2) throw new AppError('service_name', 422, sq.errors.service_name);
  let durationMin = Math.round(Number(s.durationMin));
  if (!isFinite(durationMin) || durationMin < 5) durationMin = 30;
  durationMin = Math.min(durationMin, 720);
  return {
    name, durationMin, priceCents: parsePrice(s.price), priceFrom: !!s.priceFrom,
    description: (s.description || '').trim().slice(0, 80), active: s.active !== false,
  };
}

/* ---- slugs -------------------------------------------------------------------- */
const slugTaken = async (slug: string) => !!(await db.business.findUnique({ where: { slug }, select: { id: true } }));

export async function slugCheck(name: string, city: string, wanted?: string) {
  const suggestion = await freeSlug(name || 'biznesi', city || '', slugTaken);
  const slug = wanted ? slugify(wanted) : slugify(name);
  const available = isValidSlug(slug) && !(await slugTaken(slug));
  return { slug: available ? slug : suggestion, available, suggestion };
}

/* ---- onboarding ---------------------------------------------------------------- */
export type CreateBusinessInput = {
  name?: string; category?: string; city?: string; slug?: string; phone?: string; address?: string;
  services?: ServiceInput[]; hours?: HoursDoc; ownerName?: string; listing?: string;
};

export async function createBusiness(user: User, input: CreateBusinessInput): Promise<Business> {
  const name = (input.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 2) throw new AppError('business_name', 422, sq.errors.business_name);
  if (await db.business.findFirst({ where: { ownerId: user.id } })) throw new AppError('has_business', 409, sq.errors.has_business);
  const category = CATEGORIES.includes(input.category || '') ? input.category! : 'tjeter';
  const city = (input.city || '').trim().slice(0, 40) || 'Prishtinë';
  const services = (input.services || []).filter((s) => (s.name || '').trim()).map(cleanService);
  if (!services.some((s) => s.active)) throw new AppError('no_service', 422, sq.errors.no_service);
  const rows = hoursToRows(input.hours || defaultHours(category));
  const phone = normalizePhone(input.phone) || user.phone;

  let slug = input.slug ? slugify(input.slug) : '';
  if (!slug || !isValidSlug(slug) || (await slugTaken(slug))) slug = await freeSlug(name, city, slugTaken);

  return db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: { ownerId: user.id, slug, name, category, city, address: (input.address || '').trim().slice(0, 120), phone, whatsapp: phone, onboardedAt: new Date() },
    });
    const ownerName = (input.ownerName || user.name || name).trim().slice(0, 60);
    await tx.staff.create({ data: { businessId: business.id, name: ownerName, sort: 0 } });
    await tx.service.createMany({ data: services.map((s, i) => ({ ...s, businessId: business.id, sort: i })) });
    await tx.workingHours.createMany({ data: rows.map((r) => ({ ...r, businessId: business.id })) });
    if (input.ownerName && !user.name) await tx.user.update({ where: { id: user.id }, data: { name: ownerName } });
    // A Faqja Gati page made with the same phone number gets its booking button linked.
    await tx.page.updateMany({ where: { businessId: null, OR: [{ ownerUserId: user.id }, { contactPhone: phone }] }, data: { businessId: business.id, ownerUserId: user.id } });
    // v7: "Merre falas" from an unclaimed listing (linked at once only when the verified phone is the listing's phone).
    if (input.listing) await claimListing(tx, input.listing, business.id, user.phone);
    return business;
  });
}

/** Deleting an account: bookings first (they point to staff, services and customers), then the rest cascades. */
export async function deleteBusinessAndUser(user: User) {
  const list = await db.business.findMany({ where: { ownerId: user.id }, select: { id: true } });
  await db.$transaction(async (tx) => {
    for (const b of list) {
      await tx.booking.deleteMany({ where: { businessId: b.id } });
      await tx.business.delete({ where: { id: b.id } });
    }
    await tx.session.deleteMany({ where: { userId: user.id } });
    if (user.role !== 'admin') await tx.user.delete({ where: { id: user.id } });
  });
}

/* ---- "Gjej" ---------------------------------------------------------------------- */
export type FoundBusiness = {
  slug: string; name: string; category: string; city: string; address: string; photoUrl: string;
  nextDate: string | null; nextTime: string | null; priceFromCents: number | null; paused: boolean;
  /** v6 search: the service that matched the search words (shown under the name), if the name did not. */
  matchedService?: string | null;
};
const FIND_MAX = 60;

/** v4 audit: the list costs about four database queries per business, on every visit of the home and "Gjej" pages.
 *  The result is kept for 30 seconds per city + category (per server instance). Tests pass their own `now` and skip it. */
const findCache = new Map<string, { at: number; list: FoundBusiness[] }>();
export async function findBusinesses(city?: string, category?: string, nowArg?: Date, q?: string): Promise<FoundBusiness[]> {
  const words = searchWords(q || '');
  const key = `${city || ''}|${category || ''}|${words.join(' ')}`;
  const hit = findCache.get(key);
  if (!nowArg && !process.env.VITEST && hit && Date.now() - hit.at < 30_000) return hit.list;
  const list = await findBusinessesNow(city, category, nowArg ?? new Date(), words);
  if (!nowArg) { if (findCache.size > 200) findCache.clear(); findCache.set(key, { at: Date.now(), list }); }
  return list;
}

async function findBusinessesNow(city: string | undefined, category: string | undefined, now: Date, words: string[] = []): Promise<FoundBusiness[]> {
  const all = await db.business.findMany({
    where: { listedInFind: true, suspendedAt: null, isDemo: false, onboardedAt: { not: null }, ...(city ? { city } : {}), ...(category ? { category } : {}) },
    include: { services: { where: { active: true, deleted: false }, orderBy: { sort: 'asc' } } },
    orderBy: { createdAt: 'asc' },
    take: words.length ? 2000 : FIND_MAX,
  });
  // v6 global search: score every business on the words, keep the matches, best first (then the soonest free time).
  const scored = all.filter((b) => b.services.length).map((b) => ({ b, ...searchScore(b, words) })).filter((x) => x.score > 0);
  if (words.length) scored.sort((x, y) => y.score - x.score);
  const list = scored.slice(0, FIND_MAX);
  const out: (FoundBusiness & { _score: number })[] = [];
  for (const { b, score, service } of list) {
    const prices = b.services.map((s) => s.priceCents).filter((p): p is number => p !== null);
    const item: FoundBusiness & { _score: number } = {
      slug: b.slug, name: b.name, category: b.category, city: b.city, address: b.address, photoUrl: b.photoUrl,
      nextDate: null, nextTime: null, priceFromCents: prices.length ? Math.min(...prices) : null, paused: b.bookingsPaused,
      matchedService: service, _score: score,
    };
    if (!b.bookingsPaused) {
      const today = toLocal(now, b.timezone).date;
      const ctx = await loadCtx(b, today, 14);
      const shortest = [...b.services].sort((x, y) => x.durationMin - y.durationMin)[0];
      for (let d = 0; d < 14 && !item.nextDate; d++) {
        const date = addDays(today, d);
        if (isClosed(ctx, date)) continue;
        const free = freeStarts(ctx, shortest, null, date, now);
        if (free.length) { item.nextDate = date; item.nextTime = free[0].time; }
      }
    }
    out.push(item);
  }
  const key = (f: FoundBusiness) => (f.nextDate ? `${f.nextDate} ${f.nextTime}` : f.paused ? 'zz' : 'z');
  // Without words: soonest free time first. With words: best match first, the soonest free time breaks ties.
  out.sort((a, b) => (words.length ? b._score - a._score : 0) || key(a).localeCompare(key(b)));
  return out.map(({ _score, ...f }) => f);
}
