// Bookings against a real (test) database: free times, double booking, limits, cancel.
import type { Business, Service } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freeStarts, loadCtx } from '../lib/availability';
import { cancelByToken, createManualBooking, createPublicBooking, updateBooking } from '../lib/booking';
import { createBusiness, defaultHours } from '../lib/business';
import { randomId } from '../lib/config';
import { AppError, db } from '../lib/db';
import { addDays, localToUtc, toLocal, weekdayOf } from '../lib/time';

let biz: Business;
let cut: Service;      // 30 min
let combo: Service;    // 45 min
let monday: string;    // a Monday 1–2 weeks ahead: open 09:00–20:00, pause 13:00–13:30
const now = new Date();
let n = 0;
const phone = () => `+38344${String(100000 + ++n)}`;

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof AppError ? e.code : String(e); }
};
const free = async (service: Service, date: string) => freeStarts(await loadCtx(biz, date, 1), service, null, date, now).map((s) => s.time);
const book = (time: string, service = cut, extra: Record<string, unknown> = {}) =>
  createPublicBooking(biz, { serviceId: service.id, date: monday, time, name: 'Test Klienti', phone: phone(), now, skipRateLimit: true, ...extra });

beforeAll(async () => {
  const user = await db.user.create({ data: { phone: `+38349${String(Date.now()).slice(-6)}`, name: 'Pronari' } });
  const hours = defaultHours('berber');
  hours.pause = { on: true, start: '13:00', end: '13:30' };
  biz = await createBusiness(user, {
    name: `Berber Test ${randomId(5)}`, category: 'berber', city: 'Gjakovë',
    services: [{ name: 'Qethje', durationMin: 30, price: 5 }, { name: 'Qethje + mjekër', durationMin: 45, price: '7' }],
    hours,
  });
  const services = await db.service.findMany({ where: { businessId: biz.id }, orderBy: { sort: 'asc' } });
  [cut, combo] = services;
  const today = toLocal(now, biz.timezone).date;
  monday = addDays(today, 8 - weekdayOf(today));
});

afterAll(async () => { await db.$disconnect(); });

describe('free times', () => {
  it('follow the opening hours, the grid and the pause', async () => {
    const t = await free(cut, monday);
    expect(t[0]).toBe('09:00');
    expect(t).toContain('12:30');
    expect(t).not.toContain('12:45');          // 30 min would run into the pause
    expect(t).not.toContain('13:00');
    expect(t).toContain('13:30');
    expect(t[t.length - 1]).toBe('19:30');     // last start that ends by 20:00
    expect((await free(combo, monday)).at(-1)).toBe('19:15');
  });

  it('are empty on a closed day and beyond the booking window', async () => {
    expect(await free(cut, addDays(monday, 6))).toEqual([]);                    // Sunday
    expect(await free(cut, addDays(monday, 7 * 8))).toEqual([]);                // more than 30 days ahead
    expect(await free(cut, addDays(toLocal(now).date, -1))).toEqual([]);        // yesterday
  });
});

describe('no double booking', () => {
  it('a booked time disappears, together with every start that would overlap it', async () => {
    const b = await book('10:00');
    expect(b.token.length).toBeGreaterThan(15);
    expect(b.startsAt.toISOString()).toBe(localToUtc(monday, '10:00').toISOString());
    const t = await free(cut, monday);
    expect(t).not.toContain('10:00');
    expect(t).not.toContain('09:45');
    expect(t).not.toContain('10:15');
    expect(t).toContain('09:30');
    expect(t).toContain('10:30');
    expect(await free(combo, monday)).not.toContain('09:30');                   // 45 min from 09:30 would overlap
  });

  it('the same time cannot be booked twice', async () => {
    expect(await code(book('10:00'))).toBe('slot_taken');
    expect(await code(book('10:15'))).toBe('slot_taken');                       // overlaps the 10:00 booking
    expect(await code(book('09:45', combo))).toBe('slot_taken');
  });

  it('two customers confirming the same time at the same moment: exactly one gets it', async () => {
    const results = await Promise.all([code(book('11:00')), code(book('11:00')), code(book('11:00')), code(book('11:15'))]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'slot_taken')).toHaveLength(3);
    const start = localToUtc(monday, '11:00'), end = localToUtc(monday, '12:00');
    expect(await db.booking.count({ where: { businessId: biz.id, status: 'confirmed', startsAt: { gte: start, lt: end } } })).toBe(1);
  });

  it('times outside the hours, in the pause or off the grid are refused', async () => {
    expect(await code(book('08:00'))).toBe('slot_taken');
    expect(await code(book('13:00'))).toBe('slot_taken');
    expect(await code(book('20:00'))).toBe('slot_taken');
    expect(await code(book('14:05'))).toBe('slot_taken');
  });

  it('a blocked time and a day off cannot be booked', async () => {
    await db.timeOff.create({ data: { businessId: biz.id, kind: 'block', startsAt: localToUtc(monday, '15:00'), endsAt: localToUtc(monday, '16:00') } });
    expect(await code(book('15:30'))).toBe('slot_taken');
    const tuesday = addDays(monday, 1);
    await db.timeOff.create({ data: { businessId: biz.id, kind: 'holiday', startsAt: localToUtc(tuesday, '00:00'), endsAt: localToUtc(addDays(tuesday, 1), '00:00') } });
    expect(await free(cut, tuesday)).toEqual([]);
  });
});

describe('customer rules', () => {
  it('validates the name and the phone', async () => {
    expect(await code(book('16:00', cut, { name: ' ' }))).toBe('name_required');
    expect(await code(book('16:00', cut, { phone: '12345' }))).toBe('invalid_phone');
    expect(await code(book('16:00', cut, { website: 'http://spam' }))).toBe('bad_request');   // honeypot
  });

  it('allows at most 3 active bookings per phone', async () => {
    const p = phone();
    for (const time of ['16:00', '16:30', '17:00']) expect(await code(book(time, cut, { phone: p }))).toBe('ok');
    expect(await code(book('17:30', cut, { phone: p }))).toBe('too_many_active');
  });

  it('refuses blocked numbers and paused businesses', async () => {
    const p = phone();
    await book('18:00', cut, { phone: p });
    await db.customer.updateMany({ where: { businessId: biz.id, phone: p }, data: { blocked: true } });
    expect(await code(book('18:30', cut, { phone: p }))).toBe('blocked');
    const paused = { ...biz, bookingsPaused: true };
    expect(await code(createPublicBooking(paused, { serviceId: cut.id, date: monday, time: '18:30', name: 'Test', phone: phone(), now, skipRateLimit: true }))).toBe('paused');
  });

  it('cancelling frees the time again; too late is refused', async () => {
    const b = await book('19:00');
    expect(await free(cut, monday)).not.toContain('19:00');
    const late = new Date(b.startsAt.getTime() - 30 * 60000);                    // 30 min before, cut-off is 2 hours
    expect(await code(cancelByToken(b.token, late))).toBe('too_late');
    await cancelByToken(b.token, now);
    expect(await free(cut, monday)).toContain('19:00');
    expect(await code(book('19:00'))).toBe('ok');
  });
});

describe('owner bookings', () => {
  it('warns about an overlap and lets the owner overbook on purpose', async () => {
    const wed = addDays(monday, 2);
    const first = await createManualBooking(biz, { serviceId: cut.id, date: wed, time: '10:00', name: 'Klient me telefon' });
    expect(first.source).toBe('manual');
    expect(await code(createManualBooking(biz, { serviceId: cut.id, date: wed, time: '10:15', name: 'Tjetri' }))).toBe('overlap');
    expect(await code(createManualBooking(biz, { serviceId: cut.id, date: wed, time: '10:15', name: 'Tjetri', force: true }))).toBe('ok');
  });

  it('a no-show is counted on the customer and a cancelled booking frees the time', async () => {
    const thu = addDays(monday, 3);
    const p = phone();
    const b = await createPublicBooking(biz, { serviceId: cut.id, date: thu, time: '09:00', name: 'Mosardhës', phone: p, now, skipRateLimit: true });
    await updateBooking(biz, b.id, { status: 'no_show' });
    const c = await db.customer.findFirstOrThrow({ where: { businessId: biz.id, phone: p } });
    expect(c.noShowCount).toBe(1);
    await updateBooking(biz, b.id, { status: 'cancelled_business' });
    expect(await free(cut, thu)).toContain('09:00');
  });

  it('moving a booking onto a taken time, or undoing a cancel after the slot was rebooked, is refused (audit)', async () => {
    const fri = addDays(monday, 4);
    const a = await createPublicBooking(biz, { serviceId: cut.id, date: fri, time: '11:00', name: 'Klienti A', phone: phone(), now, skipRateLimit: true });
    const b = await createPublicBooking(biz, { serviceId: cut.id, date: fri, time: '12:00', name: 'Klienti B', phone: phone(), now, skipRateLimit: true });
    expect(await code(updateBooking(biz, b.id, { date: fri, time: '11:15' }))).toBe('overlap');
    expect(await code(updateBooking(biz, b.id, { date: fri, time: '14:00' }))).toBe('ok');
    await updateBooking(biz, a.id, { status: 'cancelled_business' });
    await createPublicBooking(biz, { serviceId: cut.id, date: fri, time: '11:00', name: 'Klienti C', phone: phone(), now, skipRateLimit: true });
    expect(await code(updateBooking(biz, a.id, { status: 'confirmed' }))).toBe('overlap');
  });
});
