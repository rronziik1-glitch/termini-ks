// v5: the spam guard accepts bookings as "to confirm" (pending) instead of refusing real customers.
import type { Business, Service } from '@prisma/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cancelByToken, createPublicBooking, displayStatus, MAX_NEW_NUMBERS_PER_WINDOW, PENDING_HOLD_MS, updateBooking } from '../lib/booking';
import { freeStarts, loadCtx } from '../lib/availability';
import { createBusiness, defaultHours } from '../lib/business';
import { randomId } from '../lib/config';
import { db } from '../lib/db';
import { faqjaGatiOn, isFgPath } from '../lib/features';
import { addDays, toLocal, weekdayOf } from '../lib/time';

let biz: Business;
let cut: Service;
let day: string;
const now = new Date();
let n = 0;
const phone = () => `+38349${String(300000 + n++)}`;

beforeAll(async () => {
  const user = await db.user.create({ data: { phone: `+38344${String(Date.now()).slice(-6)}`, name: 'Pronari v5' } });
  biz = await createBusiness(user, {
    name: `Pending Test ${randomId(5)}`, category: 'berber', city: 'Gjakovë',
    services: [{ name: 'Qethje', durationMin: 30, price: 5 }], hours: defaultHours('berber'),
  });
  cut = (await db.service.findFirst({ where: { businessId: biz.id } }))!;
  const today = toLocal(now, biz.timezone).date;
  day = addDays(today, 8 - weekdayOf(today)); // next Monday
});

/** Fills the spam window so the next new number becomes pending. */
async function fillWindow(times: string[]) {
  for (let i = 0; i < MAX_NEW_NUMBERS_PER_WINDOW; i++) {
    await createPublicBooking(biz, { serviceId: cut.id, date: day, time: times[i], name: 'Klient i ri', phone: phone(), now });
  }
}

afterEach(async () => {
  await db.booking.deleteMany({ where: { businessId: biz.id } });
  await db.customer.deleteMany({ where: { businessId: biz.id } });
});

describe('v5: "to confirm" bookings', () => {
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];

  it('the 7th new number in 30 minutes is accepted as pending, not refused', async () => {
    await fillWindow(times);
    const b = await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:00', name: 'Klienti 7', phone: phone(), now });
    expect(b.status).toBe('pending');
    expect(displayStatus(b, now)).toBe('pending');
  });

  it('a pending booking holds its slot (no double booking)', async () => {
    await fillWindow(times);
    await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:00', name: 'Klienti 7', phone: phone(), now });
    const ctx = await loadCtx(biz, day, 1);
    expect(freeStarts(ctx, cut, null, day, now).map((s) => s.time)).not.toContain('12:00');
    await expect(createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:00', name: 'Tjetri', phone: phone(), now, skipRateLimit: true }))
      .rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('owner confirms → confirmed; owner refuses → slot is free again', async () => {
    await fillWindow(times);
    const a = await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:00', name: 'Klienti A', phone: phone(), now });
    const b = await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:30', name: 'Klienti B', phone: phone(), now });
    expect([a.status, b.status]).toEqual(['pending', 'pending']);
    await updateBooking(biz, a.id, { status: 'confirmed' });
    await updateBooking(biz, b.id, { status: 'cancelled_business' });
    expect((await db.booking.findUnique({ where: { id: a.id } }))!.status).toBe('confirmed');
    expect((await db.booking.findUnique({ where: { id: b.id } }))!.status).toBe('cancelled_business');
    const events = await db.bookingEvent.findMany({ where: { bookingId: { in: [a.id, b.id] } }, select: { type: true } });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['confirmed', 'refused']));
    const ctx = await loadCtx(biz, day, 1);
    const free = freeStarts(ctx, cut, null, day, now).map((s) => s.time);
    expect(free).not.toContain('12:00');
    expect(free).toContain('12:30');
  });

  it(`an unanswered pending booking expires after ${PENDING_HOLD_MS / 3600e3} hours and frees the slot`, async () => {
    await fillWindow(times);
    const p = await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:00', name: 'Klienti 7', phone: phone(), now });
    await db.booking.update({ where: { id: p.id }, data: { createdAt: new Date(now.getTime() - PENDING_HOLD_MS - 60e3), pendingUntil: new Date(now.getTime() - 60e3) } });
    const old = (await db.booking.findUnique({ where: { id: p.id } }))!;
    expect(displayStatus(old)).toBe('expired');
    const ctx = await loadCtx(biz, day, 1);
    expect(freeStarts(ctx, cut, null, day, now).map((s) => s.time)).toContain('12:00');
  });

  it('the customer can cancel their own pending request', async () => {
    await fillWindow(times);
    const p = await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '12:00', name: 'Klienti 7', phone: phone(), now });
    const r = await cancelByToken(p.token, now);
    expect(r.status).toBe('cancelled_customer');
  });

  it('a blocked number is still refused', async () => {
    const ph = phone();
    await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '09:00', name: 'Spam', phone: ph, now });
    await db.customer.updateMany({ where: { businessId: biz.id }, data: { blocked: true } });
    await expect(createPublicBooking(biz, { serviceId: cut.id, date: day, time: '10:00', name: 'Spam', phone: ph, now }))
      .rejects.toMatchObject({ code: 'blocked' });
  });
});

describe('v5: Faqja Gati is off until it opens', () => {
  const saved = process.env.FAQJA_GATI_ENABLED;
  afterEach(() => { process.env.FAQJA_GATI_ENABLED = saved; });

  it('is off by default and on with FAQJA_GATI_ENABLED=1', () => {
    delete process.env.FAQJA_GATI_ENABLED;
    expect(faqjaGatiOn()).toBe(false);
    process.env.FAQJA_GATI_ENABLED = '1';
    expect(faqjaGatiOn()).toBe(true);
  });

  it('knows which addresses belong to Faqja Gati (and keeps Termini and payments open)', () => {
    for (const p of ['/faqja', '/faqja/krijo', '/p/berberi-arti', '/api/pages/x/status', '/fg/base.css']) expect(isFgPath(p)).toBe(true);
    for (const p of ['/', '/b/berberi-arti', '/gjej', '/fillo', '/app', '/api/payments/paysera/callback', '/faqjax', '/pyetje']) expect(isFgPath(p)).toBe(false);
  });
});
