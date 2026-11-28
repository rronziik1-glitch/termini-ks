// v7 growth features: unclaimed listings + demand + claim, automatic messages (reminder, bring them back, review),
// booking consent and attribution, money book, review page, demo businesses hidden, cron protection.
import type { Business, Service } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPublicBooking } from '../lib/booking';
import { createBusiness, defaultHours, findBusinesses } from '../lib/business';
import { randomId } from '../lib/config';
import { AppError, db } from '../lib/db';
import { dispatch } from '../lib/http';
import { addListingRequest, claimListing, findListings, importListings, parseListingCsv } from '../lib/listings';
import { isLate, markMessage, outbox, planMessages, visitRhythmDays } from '../lib/messages';
import { monthMoney, moneyCsv, thisMonth } from '../lib/money';
import { addDays, localToUtc, toLocal, weekdayOf } from '../lib/time';
import '../lib/api/public';
import '../lib/api/growth';

const DAY = 864e5;
const uniq = () => randomId(6).toLowerCase();
const phone = (p = '+38344') => p + String(Math.floor(100000 + Math.random() * 899999));
const code = async (fn: () => Promise<unknown>) => { try { await fn(); return 'ok'; } catch (e) { return e instanceof AppError ? e.code : String(e); } };
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined) => { if (!(k in saved)) saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; };
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; delete saved[k]; } });
afterAll(async () => { await db.$disconnect(); });

async function newBiz(extra: Partial<Business> = {}) {
  const user = await db.user.create({ data: { phone: phone('+38348'), name: 'Pronari' } });
  const b = await createBusiness(user, { name: `Berberi ${uniq()}`, category: 'berber', city: 'Gjakovë', services: [{ name: 'Qethje', durationMin: 30, price: 5 }], hours: defaultHours('berber') });
  if (Object.keys(extra).length) await db.business.update({ where: { id: b.id }, data: extra });
  const biz = (await db.business.findUnique({ where: { id: b.id } }))!;
  const svc = (await db.service.findFirst({ where: { businessId: b.id } }))!;
  const staff = (await db.staff.findFirst({ where: { businessId: b.id } }))!;
  return { biz, svc, staff, user };
}
async function addVisit(b: Business, svc: Service, staffId: string, customerId: string, startsAt: Date, status = 'confirmed', extra = {}) {
  return db.booking.create({ data: { businessId: b.id, staffId, serviceId: svc.id, customerId, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60e3), status, serviceName: svc.name, priceCents: svc.priceCents, token: randomId(22), ...extra } });
}

/* ---- bring them back: rhythm ------------------------------------------------------------------------------------------ */
describe('client rhythm', () => {
  it('is the median gap between visits, within 7..120 days', () => {
    const d = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY);
    expect(visitRhythmDays([d(0)])).toBeNull();
    expect(visitRhythmDays([d(0), d(14), d(28), d(45)])).toBe(14);
    expect(visitRhythmDays([d(0), d(2)])).toBeNull();                     // two bookings 2 days apart is not a rhythm
    expect(visitRhythmDays([d(0), d(300)])).toBe(120);
  });
  it('late = past the rhythm by 25% (at least 4 days)', () => {
    const last = new Date('2026-01-01T10:00:00Z');
    expect(isLate(last, 14, new Date(last.getTime() + 17 * DAY))).toBe(false);
    expect(isLate(last, 14, new Date(last.getTime() + 19 * DAY))).toBe(true);
    expect(isLate(last, 28, new Date(last.getTime() + 34 * DAY))).toBe(false);
    expect(isLate(last, 28, new Date(last.getTime() + 36 * DAY))).toBe(true);
  });
});

/* ---- automatic messages ----------------------------------------------------------------------------------------------- */
describe('automatic messages', () => {
  it('prepares a reminder for tomorrow, a review after a visit and a bring-back message, each only once', async () => {
    const { biz, svc, staff } = await newBiz();
    const now = new Date();
    const tz = biz.timezone;
    const tomorrow = addDays(toLocal(now, tz).date, 1);
    const regular = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Arben Krasniqi', marketingOk: true } });
    // three visits 14 days apart, the last one 30 days ago -> late
    for (const ago of [58, 44, 30]) await addVisit(biz, svc, staff.id, regular.id, new Date(now.getTime() - ago * DAY), 'completed');
    await db.customer.update({ where: { id: regular.id }, data: { visitsCount: 3, lastVisitAt: new Date(now.getTime() - 30 * DAY) } });
    const tom = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Drita' } });
    await addVisit(biz, svc, staff.id, tom.id, localToUtc(tomorrow, '15:00', tz));
    const past = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Besa' } });
    await addVisit(biz, svc, staff.id, past.id, new Date(now.getTime() - 5 * 3600e3));

    expect(await planMessages(biz, now)).toBe(3);
    expect(await planMessages(biz, now)).toBe(0);                              // nothing twice
    const box = await outbox(biz);
    expect(box.map((m) => m.kind).sort()).toEqual(['reminder24', 'review', 'winback']);
    const winback = box.find((m) => m.kind === 'winback')!;
    expect(winback.text).toContain('Arben');
    expect(winback.text).toContain('?nga=kthim');
    expect(winback.url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(box.find((m) => m.kind === 'review')!.text).toContain('/v/');
    expect(await markMessage(biz, winback.id, 'sent')).toBe(true);
    expect((await outbox(biz)).length).toBe(2);
  });

  it('never sends "bring them back" to clients who did not agree, and nothing for demo businesses', async () => {
    const { biz, svc, staff } = await newBiz();
    const now = new Date();
    const c = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Pa Leje', marketingOk: false } });
    for (const ago of [58, 44, 30]) await addVisit(biz, svc, staff.id, c.id, new Date(now.getTime() - ago * DAY), 'completed');
    await db.customer.update({ where: { id: c.id }, data: { visitsCount: 3, lastVisitAt: new Date(now.getTime() - 30 * DAY) } });
    expect((await outbox(biz)).length + (await planMessages(biz, now))).toBe(0);
    const demo = await newBiz({ isDemo: true });
    const d2 = await db.customer.create({ data: { businessId: demo.biz.id, phone: phone(), name: 'X' } });
    await addVisit(demo.biz, demo.svc, demo.staff.id, d2.id, new Date(now.getTime() - 5 * 3600e3));
    expect(await planMessages(demo.biz, now)).toBe(0);
  });

  it('switches in settings turn each kind off', async () => {
    const { biz, svc, staff } = await newBiz({ reviewAskOn: false });
    const c = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Y' } });
    await addVisit(biz, svc, staff.id, c.id, new Date(Date.now() - 5 * 3600e3));
    expect(await planMessages(biz)).toBe(0);
  });

  it('the cron route needs the secret', async () => {
    setEnv('CRON_SECRET', 'abc');
    const no = await dispatch(new Request('http://localhost/api/cron/messages'), ['cron', 'messages']);
    expect(no.status).toBe(403);
    const yes = await dispatch(new Request('http://localhost/api/cron/messages', { headers: { authorization: 'Bearer abc' } }), ['cron', 'messages']);
    expect(yes.status).toBe(200);
  });
});

/* ---- booking consent + attribution ------------------------------------------------------------------------------------- */
describe('booking: consent and "brought back by Termini"', () => {
  it('the "remind me" box sets consent; a booking after a bring-back message counts for Termini', async () => {
    const { biz, svc } = await newBiz();
    const today = toLocal(new Date(), biz.timezone).date;
    const monday = addDays(today, 8 - weekdayOf(today));
    const p = phone();
    const first = await createPublicBooking(biz, { serviceId: svc.id, date: monday, time: '10:00', name: 'Klienti', phone: p, remindMe: true, skipRateLimit: true });
    const c = (await db.customer.findUnique({ where: { id: first.customerId } }))!;
    expect(c.marketingOk).toBe(true);
    expect(first.fromWinback).toBe(false);
    await db.customer.update({ where: { id: c.id }, data: { winbackSentAt: new Date(), lastVisitAt: new Date(Date.now() - 40 * DAY) } });
    const second = await createPublicBooking(biz, { serviceId: svc.id, date: monday, time: '11:00', name: 'Klienti', phone: p, skipRateLimit: true });
    expect(second.fromWinback).toBe(true);
    const viaLink = await createPublicBooking(biz, { serviceId: svc.id, date: monday, time: '12:00', name: 'Tjetri', phone: phone(), source: 'kthim', skipRateLimit: true });
    expect(viaLink.fromWinback).toBe(true);
    expect((await db.customer.findUnique({ where: { id: viaLink.customerId } }))!.marketingOk).toBe(false);   // never silently on
  });
});

/* ---- unclaimed listings ------------------------------------------------------------------------------------------------- */
describe('unclaimed listings', () => {
  it('import is idempotent, finds by city/type/search, skips businesses already on Termini', async () => {
    const id = uniq();
    const ownPhone = phone('+38349');
    const rows = [
      { sourceId: `osm:node/${id}1`, name: `Sallon Era ${id}`, category: 'salon', city: 'Pejë', phone: '049 111 2' + String(Math.floor(Math.random() * 90) + 10), address: 'Rr. Mbretëresha Teutë' },
      { sourceId: `osm:node/${id}2`, name: `Barber ${id}`, category: 'berber', city: 'Pejë', phone: ownPhone },
    ];
    const { biz } = await newBiz();
    await db.business.update({ where: { id: biz.id }, data: { phone: ownPhone } });
    expect(await importListings(rows)).toBe(1);
    expect(await importListings(rows)).toBe(0);
    const found = await findListings({ city: 'Pejë', q: `era ${id}` });
    expect(found.map((l) => l.name)).toEqual([`Sallon Era ${id}`]);
    expect(found[0].hasPhone).toBe(true);
    expect((await findListings({ city: 'Pejë', category: 'berber', q: id })).length).toBe(0);
  });

  it('"I want to book here" counts each number once a week', async () => {
    const id = uniq();
    await importListings([{ sourceId: `osm:way/${id}`, name: `Dentist ${id}`, category: 'dentist', city: 'Prizren', phone: phone() }]);
    const l = (await db.listing.findUnique({ where: { sourceId: `osm:way/${id}` } }))!;
    const p = phone();
    expect(await addListingRequest(l.slug, { name: 'Vjosa', phone: p })).toEqual({ counted: true });
    expect(await addListingRequest(l.slug, { name: 'Vjosa', phone: p })).toEqual({ counted: false });
    expect(await addListingRequest(l.slug, { name: 'Tjetër', phone: phone() })).toEqual({ counted: true });
    expect((await db.listing.findUnique({ where: { id: l.id } }))!.requestsCount).toBe(2);
    expect(await code(() => addListingRequest(l.slug, { name: 'A', phone: '123' }))).toBe('name_required');
    expect(await code(() => addListingRequest(l.slug, { name: 'Ana', phone: '123' }))).toBe('invalid_phone');
  });

  it('claim links at once only with the listing\'s own phone; otherwise the admin checks', async () => {
    const id = uniq();
    const lp = phone('+38345');
    await importListings([{ sourceId: `osm:node/c${id}`, name: `Lavazh ${id}`, category: 'lavazh', city: 'Ferizaj', phone: lp }]);
    const l = (await db.listing.findUnique({ where: { sourceId: `osm:node/c${id}` } }))!;
    const other = await newBiz();
    expect(await db.$transaction((tx) => claimListing(tx, l.slug, other.biz.id, phone()))).toBe(false);
    const after = (await db.listing.findUnique({ where: { id: l.id } }))!;
    expect(after.status).toBe('active');
    expect(after.claimRequestPhone).not.toBe('');
    const owner = await newBiz();
    expect(await db.$transaction((tx) => claimListing(tx, l.slug, owner.biz.id, lp))).toBe(true);
    expect((await db.listing.findUnique({ where: { id: l.id } }))!.status).toBe('claimed');
    expect((await db.business.findUnique({ where: { id: owner.biz.id } }))!.listingId).toBe(l.id);
    expect(await findListings({ q: `lavazh ${id}` })).toEqual([]);              // gone from the public list
  });

  it('CSV lines accept Albanian type names', () => {
    const rows = parseListingCsv('emri; lloji; qyteti\nBerberi Dardani; Berber; Prishtinë; Rr. UÇK 12; 049 123 456\nKlinika X, Klinikë, Pejë');
    expect(rows).toEqual([
      { name: 'Berberi Dardani', category: 'berber', city: 'Prishtinë', address: 'Rr. UÇK 12', phone: '049 123 456' },
      { name: 'Klinika X', category: 'klinike', city: 'Pejë', address: '', phone: '' },
    ]);
  });
});

/* ---- demo businesses hidden -------------------------------------------------------------------------------------------- */
describe('demo businesses', () => {
  it('a demo business is not in the public lists', async () => {
    const { biz } = await newBiz();
    const name = biz.name;
    expect((await findBusinesses(undefined, undefined, new Date(), name)).map((b) => b.name)).toContain(name);
    await db.business.update({ where: { id: biz.id }, data: { isDemo: true } });
    expect((await findBusinesses(undefined, undefined, new Date(), name)).map((b) => b.name)).not.toContain(name);
  });
});

/* ---- money book ---------------------------------------------------------------------------------------------------------- */
describe('money book', () => {
  it('sums cash, card, unmarked, expenses and what Termini brought; CSV opens in Excel', async () => {
    const { biz, svc, staff } = await newBiz();
    const now = new Date();
    const month = thisMonth(biz, now);
    const c = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Ilir' } });
    const day1 = `${month}-01`;
    const at = (h: string) => localToUtc(day1, h, biz.timezone);
    if (at('10:00') > now) return;                                              // first hours of a month: nothing past yet
    await addVisit(biz, svc, staff.id, c.id, at('09:00'), 'completed', { paidMethod: 'cash', source: 'link' });
    await addVisit(biz, svc, staff.id, c.id, at('09:30'), 'completed', { paidMethod: 'card', source: 'manual' });
    await addVisit(biz, svc, staff.id, c.id, at('10:00'), 'confirmed', { source: 'find', fromWinback: true });
    await addVisit(biz, svc, staff.id, c.id, at('10:30'), 'no_show');
    await db.expense.create({ data: { businessId: biz.id, date: day1, amountCents: 300, category: 'produkte', note: 'Shampo' } });
    const m = await monthMoney(biz, month, now);
    expect(m.totals).toEqual({ income: 1500, cash: 500, card: 500, unmarked: 500, expenses: 300, profit: 1200 });
    expect(m.termini.onlineCount).toBe(2);
    expect(m.termini.winbackCount).toBe(1);
    const csv = moneyCsv(biz, m);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Shampo');
    expect(csv).toContain('Fitimi;12,00');
  });
});

/* ---- review page --------------------------------------------------------------------------------------------------------- */
describe('review after the visit', () => {
  it('saves the rating once, gives everyone the Google link, accepts a private note later', async () => {
    const { biz, svc, staff } = await newBiz({ googleReviewUrl: 'https://g.page/r/abc/review' });
    const c = await db.customer.create({ data: { businessId: biz.id, phone: phone(), name: 'Z' } });
    const b = await addVisit(biz, svc, staff.id, c.id, new Date(Date.now() - 3 * 3600e3));
    const post = (body: object) => dispatch(new Request(`http://localhost/api/public/review/${b.token}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), ['public', 'review', b.token]);
    const r1 = await post({ rating: 2 });
    expect(r1.status).toBe(200);
    expect((await r1.json()).google).toBe('https://g.page/r/abc/review');       // low rating still gets the Google link
    await post({ rating: 5, comment: 'Prita shumë' });
    const f = (await db.feedback.findUnique({ where: { bookingId: b.id } }))!;
    expect(f.rating).toBe(2);                                                    // the rating is given once
    expect(f.comment).toBe('Prita shumë');
    const future = await addVisit(biz, svc, staff.id, c.id, new Date(Date.now() + 5 * 3600e3));
    const early = await dispatch(new Request(`http://localhost/api/public/review/${future.token}`, { method: 'POST', body: JSON.stringify({ rating: 5 }) }), ['public', 'review', future.token]);
    expect(early.status).toBe(409);
  });
});
