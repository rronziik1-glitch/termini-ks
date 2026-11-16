// Owner API (session cookie required). §8.3.
import type { Booking, Business, Customer } from '@prisma/client';
import QRCode from 'qrcode';
import { rangeOnDate, workingOn } from '../availability';
import { createManualBooking, displayStatus, ownerMessage, recordMessage, updateBooking } from '../booking';
import { cleanService, createBusiness, deleteBusinessAndUser, hoursToRows, rowsToHours, slugCheck, type HoursDoc, type ServiceInput } from '../business';
import { bookingUrl } from '../config';
import { AppError, db } from '../db';
import { saveBusinessPhoto } from '../fg/images';
import { route } from '../http';
import { displayPhone, normalizePhone } from '../phone';
import { presetFor } from '../presets';
import { sq } from '../sq';
import { addDays, diffDays, isDate, isTime, localMinToUtc, localToUtc, toLocal, weekdayOf } from '../time';

const bad = () => new AppError('bad_request', 400, sq.errors.bad_request);

route('GET', '/slug-check', 'public', async (c) => slugCheck(c.query.get('name') || '', c.query.get('city') || '', c.query.get('slug') || undefined));

route('GET', '/category-presets/:category', 'public', async (c) => {
  const row = await db.categoryPreset.findUnique({ where: { category: c.params.category } });
  const fallback = presetFor(c.params.category);
  return { services: row ? JSON.parse(row.servicesJson) : fallback.services, hours: row ? JSON.parse(row.hoursJson) : fallback.hours };
});

/* ---- business --------------------------------------------------------------------- */
route('POST', '/business', 'user', async (c) => {
  const body = await c.body<Record<string, unknown>>();
  const b = await createBusiness(c.me, {
    name: body.name as string, category: body.category as string, city: body.city as string, slug: body.slug as string,
    services: body.services as ServiceInput[], hours: body.hours as HoursDoc, ownerName: body.owner_name as string,
  });
  return { slug: b.slug, url: bookingUrl(b.slug, c.origin) };
});

route('PATCH', '/business', 'owner', async (c) => {
  const body = await c.body<Record<string, unknown>>();
  const data: Record<string, unknown> = {};
  const str = (k: string, max: number) => { if (typeof body[k] === 'string') data[k] = (body[k] as string).trim().slice(0, max); };
  if (body.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, ' ').slice(0, 60);
    if (name.length < 2) throw new AppError('business_name', 422, sq.errors.business_name);
    data.name = name;
  }
  str('description', 140); str('city', 40); str('address', 120);
  if (typeof body.instagram === 'string') data.instagram = body.instagram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').slice(0, 40);
  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
    data.phone = phone; data.whatsapp = phone;
  }
  const pick = (k: string, allowed: number[]) => { if (body[k] !== undefined) { const n = Number(body[k]); if (!allowed.includes(n)) throw bad(); data[k] = n; } };
  pick('slotStepMin', [15, 30]); pick('minNoticeMin', [30, 60, 120, 1440]); pick('maxAdvanceDays', [7, 14, 30, 60]); pick('cancelCutoffMin', [60, 120, 360, 1440]);
  if (typeof body.bookingsPaused === 'boolean') data.bookingsPaused = body.bookingsPaused;
  if (typeof body.listedInFind === 'boolean') data.listedInFind = body.listedInFind;
  if (typeof body.lat === 'number' && typeof body.lng === 'number') { data.lat = body.lat; data.lng = body.lng; }
  const b = await db.business.update({ where: { id: c.biz.id }, data });
  return { ok: true, name: b.name };
});

route('DELETE', '/business', 'owner', async (c) => {
  const body = await c.body<{ confirm?: string }>();
  if ((body.confirm || '').trim().toUpperCase() !== sq.settings.deleteWord) throw bad();
  await deleteBusinessAndUser(c.me);
  return { ok: true };
});

route('POST', '/business/photo', 'owner', async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size > 12e6) throw new AppError('photo_type', 415, sq.errors.photo_type);
  await saveBusinessPhoto(c.biz.id, Buffer.from(await file.arrayBuffer()));
  const photoUrl = `/api/public/businesses/${c.biz.slug}/photo?v=${Date.now()}`;
  await db.business.update({ where: { id: c.biz.id }, data: { photoUrl } });
  return { photoUrl };
});

route('GET', '/business/qr.svg', 'owner', async (c) => {
  const svg = await QRCode.toString(bookingUrl(c.biz.slug, c.origin), { type: 'svg', margin: 2, width: 640, errorCorrectionLevel: 'M' });
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'content-disposition': `${c.query.get('download') ? 'attachment' : 'inline'}; filename="termini-${c.biz.slug}.svg"` } });
});

/* ---- services ---------------------------------------------------------------------- */
async function serviceList(businessId: string) {
  const [services, future] = await Promise.all([
    db.service.findMany({ where: { businessId, deleted: false }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
    db.booking.groupBy({ by: ['serviceId'], where: { businessId, status: 'confirmed', startsAt: { gt: new Date() } }, _count: true }),
  ]);
  return services.map((s) => ({
    id: s.id, name: s.name, description: s.description, durationMin: s.durationMin, priceCents: s.priceCents, priceFrom: s.priceFrom, active: s.active,
    futureBookings: future.find((f) => f.serviceId === s.id)?._count || 0,
  }));
}

route('GET', '/services', 'owner', async (c) => ({ services: await serviceList(c.biz.id) }));

route('POST', '/services', 'owner', async (c) => {
  const data = cleanService(await c.body<ServiceInput>());
  const last = await db.service.findFirst({ where: { businessId: c.biz.id }, orderBy: { sort: 'desc' } });
  await db.service.create({ data: { ...data, businessId: c.biz.id, sort: (last?.sort ?? -1) + 1 } });
  return { services: await serviceList(c.biz.id) };
});

route('PUT', '/services/order', 'owner', async (c) => {
  const { ids } = await c.body<{ ids: string[] }>();
  if (!Array.isArray(ids)) throw bad();
  const own = await db.service.findMany({ where: { businessId: c.biz.id }, select: { id: true } });
  const valid = ids.filter((id) => own.some((s) => s.id === id));
  await db.$transaction(valid.map((id, i) => db.service.update({ where: { id }, data: { sort: i } })));
  return { services: await serviceList(c.biz.id) };
});

route('PATCH', '/services/:id', 'owner', async (c) => {
  const s = await db.service.findFirst({ where: { id: c.params.id, businessId: c.biz.id } });
  if (!s) throw new AppError('not_found', 404, sq.errors.not_found);
  const body = await c.body<ServiceInput & { deleted?: boolean }>();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined || body.durationMin !== undefined || body.price !== undefined) {
    Object.assign(data, cleanService({ name: body.name ?? s.name, durationMin: body.durationMin ?? s.durationMin, price: body.price === undefined ? (s.priceCents === null ? null : s.priceCents / 100) : body.price, priceFrom: body.priceFrom ?? s.priceFrom, description: body.description ?? s.description, active: body.active ?? s.active }));
  } else if (typeof body.active === 'boolean') data.active = body.active;
  if (body.deleted === false) { data.deleted = false; data.active = true; }          // undo of a delete
  await db.service.update({ where: { id: s.id }, data });
  return { services: await serviceList(c.biz.id) };
});

route('DELETE', '/services/:id', 'owner', async (c) => {
  const s = await db.service.findFirst({ where: { id: c.params.id, businessId: c.biz.id } });
  if (!s) throw new AppError('not_found', 404, sq.errors.not_found);
  await db.service.update({ where: { id: s.id }, data: { deleted: true, active: false } });   // kept: bookings point to it
  return { services: await serviceList(c.biz.id) };
});

/* ---- hours and days off ------------------------------------------------------------- */
route('GET', '/hours', 'owner', async (c) => rowsToHours(await db.workingHours.findMany({ where: { businessId: c.biz.id } })));

route('PUT', '/hours', 'owner', async (c) => {
  const rows = hoursToRows(await c.body<HoursDoc>());
  await db.$transaction([
    db.workingHours.deleteMany({ where: { businessId: c.biz.id, staffId: null } }),
    db.workingHours.createMany({ data: rows.map((r) => ({ ...r, businessId: c.biz.id })) }),
  ]);
  return rowsToHours(await db.workingHours.findMany({ where: { businessId: c.biz.id } }));
});

export async function daysOffList(b: Business) {
  const rows = await db.timeOff.findMany({ where: { businessId: b.id, kind: 'holiday', endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' } });
  return rows.map((t) => {
    const from = toLocal(t.startsAt, b.timezone).date;
    const to = toLocal(new Date(t.endsAt.getTime() - 60000), b.timezone).date;
    return { id: t.id, from, to, days: diffDays(from, to) + 1, reason: t.reason };
  });
}

route('GET', '/time-off', 'owner', async (c) => ({ daysOff: await daysOffList(c.biz) }));

route('POST', '/time-off', 'owner', async (c) => {
  const body = await c.body<Record<string, string>>();
  const tz = c.biz.timezone;
  const reason = (body.reason || '').trim().slice(0, 80);
  if (body.kind === 'block') {
    if (!isDate(body.date) || !isTime(body.start) || !isTime(body.end) || body.end <= body.start) throw bad();
    const t = await db.timeOff.create({ data: { businessId: c.biz.id, kind: 'block', reason, startsAt: localToUtc(body.date, body.start, tz), endsAt: localToUtc(body.date, body.end, tz) } });
    return { id: t.id };
  }
  const from = body.from, to = body.to || body.from;
  if (!isDate(from) || !isDate(to) || to < from || diffDays(from, to) > 120) throw bad();
  const startsAt = localMinToUtc(from, 0, tz), endsAt = localMinToUtc(addDays(to, 1), 0, tz);
  const clash = await db.booking.findMany({ where: { businessId: c.biz.id, status: 'confirmed', startsAt: { gte: startsAt, lt: endsAt } }, orderBy: { startsAt: 'asc' } });
  if (clash.length) throw new AppError('day_has_bookings', 409, sq.errors.day_has_bookings(clash.length), { date: toLocal(clash[0].startsAt, tz).date });
  await db.timeOff.create({ data: { businessId: c.biz.id, kind: 'holiday', reason, startsAt, endsAt } });
  return { daysOff: await daysOffList(c.biz) };
});

route('DELETE', '/time-off/:id', 'owner', async (c) => {
  await db.timeOff.deleteMany({ where: { id: c.params.id, businessId: c.biz.id } });
  return { daysOff: await daysOffList(c.biz) };
});

/* ---- bookings (calendar) -------------------------------------------------------------- */
type Row = Booking & { customer: Customer; service: { durationMin: number } };

function bookingJson(b: Row, biz: Business, origin: string, now: Date) {
  const tz = biz.timezone;
  const s = toLocal(b.startsAt, tz), e = toLocal(b.endsAt, tz);
  const full = { ...b, business: biz };
  const link = (type: string) => ownerMessage(full, type, origin, now)?.url || '';
  return {
    id: b.id, date: s.date, startMin: s.minutes, endMin: e.date === s.date ? e.minutes : 1440, time: s.time, endTime: e.time,
    status: displayStatus(b, now), rawStatus: b.status, serviceId: b.serviceId, serviceName: b.serviceName,
    durationMin: Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000), priceCents: b.priceCents, note: b.customerNote, source: b.source,
    reminderSent: !!b.reminderSentAt,
    customer: {
      id: b.customer.id, name: b.customer.name, phone: b.customer.phone || '', phoneDisplay: displayPhone(b.customer.phone),
      visits: b.customer.visitsCount, noShows: b.customer.noShowCount, isNew: b.customer.visitsCount === 0 || (b.customer.visitsCount === 1 && b.endsAt < now),
    },
    wa: { reminder: link('reminder'), confirm: link('confirm'), cancel: link('cancel'), noshow: link('noshow') },
  };
}

route('GET', '/bookings', 'owner', async (c) => {
  const b = c.biz, tz = b.timezone, now = new Date();
  const nowL = toLocal(now, tz);
  const from = isDate(c.query.get('from')) ? c.query.get('from')! : nowL.date;
  const to = isDate(c.query.get('to')) ? c.query.get('to')! : from;
  if (to < from || diffDays(from, to) > 62) throw bad();
  const start = localMinToUtc(from, 0, tz), end = localMinToUtc(addDays(to, 1), 0, tz);
  const [rows, hours, timeOff, total] = await Promise.all([
    db.booking.findMany({ where: { businessId: b.id, startsAt: { gte: start, lt: end } }, include: { customer: true, service: { select: { durationMin: true } } }, orderBy: { startsAt: 'asc' } }),
    db.workingHours.findMany({ where: { businessId: b.id } }),
    db.timeOff.findMany({ where: { businessId: b.id, startsAt: { lt: end }, endsAt: { gt: start } } }),
    db.booking.count({ where: { businessId: b.id } }),
  ]);
  const days = [];
  const blocks: { id: string; date: string; startMin: number; endMin: number; reason: string }[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const open = workingOn(hours, null, weekdayOf(date)).sort((x, y) => x.start - y.start);
    const off = timeOff.find((t) => t.kind === 'holiday' && rangeOnDate(t.startsAt, t.endsAt, date, tz));
    days.push({ date, open, closed: open.length === 0, dayOff: !!off, dayOffReason: off?.reason || '' });
    for (const t of timeOff) {
      if (t.kind !== 'block') continue;
      const r = rangeOnDate(t.startsAt, t.endsAt, date, tz);
      if (r) blocks.push({ id: t.id, date, startMin: r.start, endMin: r.end, reason: t.reason });
    }
  }
  return { today: nowL.date, nowMin: nowL.minutes, days, blocks, totalBookings: total, bookings: rows.map((r) => bookingJson(r, b, c.origin, now)) };
});

route('POST', '/bookings', 'owner', async (c) => {
  const body = await c.body<Record<string, string> & { force?: boolean }>();
  const created = await createManualBooking(c.biz, { serviceId: body.service_id, date: body.date, time: body.time, name: body.name, phone: body.phone, force: !!body.force });
  const row = await db.booking.findUniqueOrThrow({ where: { id: created.id }, include: { customer: true, service: { select: { durationMin: true } } } });
  return { booking: bookingJson(row, c.biz, c.origin, new Date()) };
});

route('PATCH', '/bookings/:id', 'owner', async (c) => {
  const body = await c.body<{ status?: string; date?: string; time?: string }>();
  await updateBooking(c.biz, c.params.id, body);
  return { ok: true };
});

route('GET', '/bookings/:id/whatsapp', 'owner', async (c) => {
  const b = await db.booking.findFirst({ where: { id: c.params.id, businessId: c.biz.id }, include: { customer: true, business: true } });
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  const type = c.query.get('type') || 'reminder';
  const msg = ownerMessage(b, type, c.origin);
  if (!msg) throw bad();
  await recordMessage(b, type, msg.text);
  return { url: msg.url };
});

/* ---- customers --------------------------------------------------------------------------- */
route('GET', '/customers', 'owner', async (c) => {
  const q = (c.query.get('q') || '').trim();
  const digits = q.replace(/\D/g, '').replace(/^0/, '');
  const rows = await db.customer.findMany({
    where: { businessId: c.biz.id, ...(q ? { OR: [{ name: { contains: q } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] } : {}) },
    orderBy: [{ lastVisitAt: 'desc' }, { createdAt: 'desc' }], take: 200,
  });
  const total = q ? await db.customer.count({ where: { businessId: c.biz.id } }) : rows.length;
  return {
    total,
    customers: rows.map((r) => ({
      id: r.id, name: r.name, phone: r.phone || '', phoneDisplay: displayPhone(r.phone), visits: r.visitsCount, noShows: r.noShowCount, blocked: r.blocked,
      lastVisit: r.lastVisitAt ? toLocal(r.lastVisitAt, c.biz.timezone).date : null,
    })),
  };
});

route('GET', '/customers/:id', 'owner', async (c) => {
  const r = await db.customer.findFirst({ where: { id: c.params.id, businessId: c.biz.id }, include: { bookings: { orderBy: { startsAt: 'desc' }, take: 30 } } });
  if (!r) throw new AppError('not_found', 404, sq.errors.not_found);
  const now = new Date();
  return {
    id: r.id, name: r.name, phone: r.phone || '', phoneDisplay: displayPhone(r.phone), note: r.note, visits: r.visitsCount, noShows: r.noShowCount, blocked: r.blocked,
    history: r.bookings.map((b) => { const l = toLocal(b.startsAt, c.biz.timezone); return { id: b.id, date: l.date, time: l.time, service: b.serviceName, priceCents: b.priceCents, status: displayStatus(b, now), upcoming: b.startsAt > now }; }),
  };
});

route('PATCH', '/customers/:id', 'owner', async (c) => {
  const body = await c.body<{ note?: string; blocked?: boolean }>();
  const r = await db.customer.findFirst({ where: { id: c.params.id, businessId: c.biz.id } });
  if (!r) throw new AppError('not_found', 404, sq.errors.not_found);
  await db.customer.update({ where: { id: r.id }, data: { note: typeof body.note === 'string' ? body.note.slice(0, 500) : undefined, blocked: typeof body.blocked === 'boolean' ? body.blocked : undefined } });
  // Blocking also frees the slots this number already took online (audit H3: bulk-cancel spam).
  let cancelled = 0;
  if (body.blocked === true) {
    const res = await db.booking.updateMany({
      where: { businessId: c.biz.id, customerId: r.id, status: 'confirmed', startsAt: { gt: new Date() } },
      data: { status: 'cancelled_business', cancelledAt: new Date() },
    });
    cancelled = res.count;
  }
  return { ok: true, cancelled };
});

/* ---- stats ----------------------------------------------------------------------------------- */
route('GET', '/stats', 'owner', async (c) => {
  const tz = c.biz.timezone, today = toLocal(new Date(), tz).date;
  const period = c.query.get('period') || 'week';
  const from = period === 'day' ? today : period === 'month' ? today.slice(0, 8) + '01' : addDays(today, 1 - weekdayOf(today));
  const to = period === 'day' ? addDays(today, 1) : period === 'month' ? addDays(from, 31).slice(0, 8) + '01' : addDays(from, 7);
  const rows = await db.booking.findMany({ where: { businessId: c.biz.id, startsAt: { gte: localMinToUtc(from, 0, tz), lt: localMinToUtc(to, 0, tz) } }, select: { status: true, priceCents: true } });
  const kept = rows.filter((r) => !r.status.startsWith('cancelled'));
  const noShows = kept.filter((r) => r.status === 'no_show').length;
  return { period, from, count: kept.length, revenueCents: kept.filter((r) => r.status !== 'no_show').reduce((s, r) => s + (r.priceCents || 0), 0), noShowRate: kept.length ? noShows / kept.length : 0 };
});
