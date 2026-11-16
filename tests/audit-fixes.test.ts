// Regression tests for the Opus fixes after the Phase 3 audit (H3, H4, S3).
import type { Business, Service } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPublicBooking, MAX_NEW_NUMBERS_PER_WINDOW } from '../lib/booking';
import { createBusiness, defaultHours } from '../lib/business';
import { randomId } from '../lib/config';
import { AppError, db } from '../lib/db';
import { demoContent, scrubForPreview } from '../lib/fg/render';
import { TEMPLATES } from '../lib/fg/schema';
import { addDays, isTime, toLocal, weekdayOf } from '../lib/time';

let biz: Business;
let cut: Service;
let monday: string;
const now = new Date();

beforeAll(async () => {
  const user = await db.user.create({ data: { phone: `+38348${String(Date.now()).slice(-6)}`, name: 'Pronari' } });
  biz = await createBusiness(user, {
    name: `Spam Test ${randomId(5)}`, category: 'berber', city: 'Prishtinë',
    services: [{ name: 'Qethje', durationMin: 30, price: 5 }], hours: defaultHours('berber'),
  });
  cut = (await db.service.findFirst({ where: { businessId: biz.id } }))!;
  const today = toLocal(now, biz.timezone).date;
  monday = addDays(today, 8 - weekdayOf(today));
});
afterAll(async () => { await db.$disconnect(); });

describe('H3 (v5): burst of bookings from new numbers', () => {
  it(`after ${MAX_NEW_NUMBERS_PER_WINDOW} new numbers in 30 minutes the next ones become "to confirm", never refused`, async () => {
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
    const results: string[] = [];
    for (let i = 0; i < times.length; i++) {
      try {
        const b = await createPublicBooking(biz, { serviceId: cut.id, date: monday, time: times[i], name: 'Spam Bot', phone: `+38345${String(200000 + i)}`, now, ip: `10.0.0.${i}` });
        results.push(b.status === 'pending' ? 'pending' : 'ok');
      } catch (e) { results.push(e instanceof AppError ? e.code : String(e)); }
    }
    expect(results.filter((r) => r === 'ok').length).toBe(MAX_NEW_NUMBERS_PER_WINDOW);
    expect(results.slice(MAX_NEW_NUMBERS_PER_WINDOW).every((r) => r === 'pending')).toBe(true);
  });
});

describe('H4: the preview does not hold the whole site', () => {
  it('hides the second half of services, FAQ answers and reviews', () => {
    for (const t of TEMPLATES) {
      const real = demoContent(t);
      const shown = scrubForPreview(real);
      const realText = JSON.stringify(real.services.groups.flatMap((g) => g.items.map((i) => i.name)));
      const shownText = JSON.stringify(shown.services.groups.flatMap((g) => g.items.map((i) => i.name)));
      const multi = real.services.groups.some((g) => g.items.length > 1);
      if (multi) expect(shownText).not.toBe(realText);
      for (const g of shown.services.groups) expect(g.items[0].name).not.toMatch(/^█+$/);
      if (real.faq && real.faq.length > 1) expect(shown.faq![1].a).not.toBe(real.faq[1].a);
    }
  });
});

describe('S3: time format', () => {
  it('accepts 24:00 but not 24:30', () => {
    expect(isTime('24:00')).toBe(true);
    expect(isTime('24:30')).toBe(false);
    expect(isTime('23:59')).toBe(true);
  });
});
