// v6 Super Admin API (role "admin": phone in ADMIN_PHONES + admin password unlock, enforced in lib/http.ts).
// Overview numbers, every registered business, a read-only view of one business (calendar, clients, history),
// suspend / unsuspend, and the audit log. Reading a business and every change are written to the audit log.
import type { Business, Prisma } from '@prisma/client';
import { daysOffList } from './owner';
import { displayStatus, pendingLive } from '../booking';
import { rowsToHours } from '../business';
import { bookingUrl } from '../config';
import { AppError, containsText, db } from '../db';
import { route } from '../http';
import { displayPhone } from '../phone';
import { sq } from '../sq';
import { TZ, addDays, localMinToUtc, toLocal } from '../time';

const DAY = 864e5;
const notFound = () => new AppError('not_found', 404, sq.errors.not_found);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const audit = (userId: string, action: string, targetType: string, targetId: string, meta: object = {}) =>
  db.auditLog.create({ data: { userId, action, targetType, targetId, metaJson: JSON.stringify(meta) } });

/** "Kept" bookings: everything that was not cancelled. */
const KEPT: Prisma.BookingWhereInput = { status: { notIn: ['cancelled_customer', 'cancelled_business'] } };

/** Counts per local day (Europe/Belgrade) for the last `days` days, oldest first. */
function perDay(dates: Date[], days: number, now: Date) {
  const today = toLocal(now, TZ).date;
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i - days + 1), n: 0 }));
  for (const d of dates) { const row = out.find((r) => r.date === toLocal(d, TZ).date); if (row) row.n++; }
  return out;
}

/* ---- overview ---------------------------------------------------------------------- */
route('GET', '/admin/overview', 'admin', async () => {
  const now = new Date();
  const todayStart = localMinToUtc(toLocal(now, TZ).date, 0, TZ);
  const since14 = new Date(todayStart.getTime() - 13 * DAY), since30 = new Date(now.getTime() - 30 * DAY), since7 = new Date(now.getTime() - 7 * DAY);
  const [total, live, suspended, paused, approval, new7, owners, customers, bToday, b7, b30, upcoming7, pending, recentBiz, recentBookings, top] = await Promise.all([
    db.business.count(),
    db.business.count({ where: { suspendedAt: null, onboardedAt: { not: null } } }),
    db.business.count({ where: { suspendedAt: { not: null } } }),
    db.business.count({ where: { bookingsPaused: true, suspendedAt: null } }),
    db.business.count({ where: { requireApproval: true } }),
    db.business.count({ where: { createdAt: { gt: since7 } } }),
    db.user.count({ where: { role: 'owner', businesses: { some: {} } } }),
    db.customer.count(),
    db.booking.count({ where: { createdAt: { gte: todayStart } } }),
    db.booking.count({ where: { createdAt: { gt: since7 } } }),
    db.booking.count({ where: { createdAt: { gt: since30 } } }),
    db.booking.count({ where: { ...KEPT, startsAt: { gt: now, lt: new Date(now.getTime() + 7 * DAY) } } }),
    db.booking.count({ where: pendingLive(now) }),
    db.business.findMany({ where: { createdAt: { gt: since14 } }, select: { createdAt: true } }),
    db.booking.findMany({ where: { createdAt: { gt: since14 } }, select: { createdAt: true } }),
    db.booking.groupBy({ by: ['businessId'], where: { createdAt: { gt: since30 } }, _count: true, orderBy: { _count: { businessId: 'desc' } }, take: 5 }),
  ]);
  const topBiz = await db.business.findMany({ where: { id: { in: top.map((t) => t.businessId) } }, select: { id: true, name: true, city: true } });
  const newest = await db.business.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, name: true, city: true, category: true, createdAt: true } });
  return {
    businesses: { total, live, suspended, paused, approval, new7 },
    owners, customers,
    bookings: { today: bToday, week: b7, month: b30, upcoming7, pending },
    signups: perDay(recentBiz.map((b) => b.createdAt), 14, now),
    bookingsPerDay: perDay(recentBookings.map((b) => b.createdAt), 14, now),
    top: top.map((t) => ({ ...topBiz.find((b) => b.id === t.businessId), bookings: t._count })).filter((t) => t.id),
    newest: newest.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
  };
});

/* ---- every business ------------------------------------------------------------------ */
const STATUSES = ['all', 'live', 'new', 'paused', 'suspended', 'inactive', 'setup'] as const;

route('GET', '/admin/businesses', 'admin', async (c) => {
  const now = new Date();
  const q = (c.query.get('q') || '').trim().slice(0, 60);
  const city = c.query.get('city') || '';
  const category = c.query.get('category') || '';
  const status = (STATUSES as readonly string[]).includes(c.query.get('status') || '') ? c.query.get('status')! : 'all';
  const digits = q.replace(/\D/g, '').replace(/^0/, '');
  const where: Prisma.BusinessWhereInput = {
    ...(city ? { city } : {}), ...(category ? { category } : {}),
    ...(q ? { OR: [{ name: containsText(q) }, { slug: containsText(q.toLowerCase()) }, { owner: { name: containsText(q) } }, ...(digits.length >= 3 ? [{ owner: { phone: { contains: digits } } }, { phone: { contains: digits } }] : [])] } : {}),
    ...(status === 'suspended' ? { suspendedAt: { not: null } } : {}),
    ...(status === 'paused' ? { bookingsPaused: true, suspendedAt: null } : {}),
    ...(status === 'live' ? { suspendedAt: null, bookingsPaused: false, onboardedAt: { not: null } } : {}),
    ...(status === 'new' ? { createdAt: { gt: new Date(now.getTime() - 7 * DAY) } } : {}),
    ...(status === 'setup' ? { onboardedAt: null } : {}),
  };
  const list = await db.business.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 500,
    include: { owner: { select: { name: true, phone: true, lastLoginAt: true } }, _count: { select: { bookings: true, customers: true } } },
  });
  const ids = list.map((b) => b.id);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const [recent, upcoming, last] = ids.length ? await Promise.all([
    db.booking.groupBy({ by: ['businessId'], where: { businessId: { in: ids }, createdAt: { gt: since30 } }, _count: true }),
    db.booking.groupBy({ by: ['businessId'], where: { businessId: { in: ids }, startsAt: { gt: now }, status: { in: ['confirmed', 'pending'] } }, _count: true }),
    db.booking.groupBy({ by: ['businessId'], where: { businessId: { in: ids } }, _max: { createdAt: true } }),
  ]) : [[], [], []];
  const count = (rows: { businessId: string; _count: number }[], id: string) => rows.find((r) => r.businessId === id)?._count || 0;
  let out = list.map((b) => ({
    id: b.id, slug: b.slug, name: b.name, category: b.category, city: b.city, url: bookingUrl(b.slug, c.origin),
    owner: b.owner.name, ownerPhone: displayPhone(b.owner.phone), ownerLastLogin: iso(b.owner.lastLoginAt),
    createdAt: b.createdAt.toISOString(), onboarded: !!b.onboardedAt, paused: b.bookingsPaused, suspended: !!b.suspendedAt,
    approval: b.requireApproval, bookings30: count(recent, b.id), upcoming: count(upcoming, b.id),
    bookingsTotal: b._count.bookings, customers: b._count.customers,
    lastBookingAt: iso(last.find((r) => r.businessId === b.id)?._max.createdAt),
  }));
  if (status === 'inactive') out = out.filter((b) => !b.suspended && b.bookings30 === 0);
  const sort = c.query.get('sort') || 'new';
  if (sort === 'active') out.sort((a, b) => b.bookings30 - a.bookings30 || b.bookingsTotal - a.bookingsTotal);
  if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'sq'));
  const cities = (await db.business.findMany({ select: { city: true }, distinct: ['city'] })).map((b) => b.city).sort();
  return { businesses: out, cities, total: await db.business.count() };
});

/* ---- one business, read-only ------------------------------------------------------------ */
async function bizById(id: string): Promise<Business> {
  const b = await db.business.findUnique({ where: { id } });
  if (!b) throw notFound();
  return b;
}

route('GET', '/admin/businesses/:id', 'admin', async (c) => {
  const b = await bizById(c.params.id);
  const now = new Date(), tz = b.timezone;
  const since30 = new Date(now.getTime() - 30 * DAY);
  const [owner, services, hoursRows, daysOff, statusCounts, revenue, upcoming, past, customers, events, staff, done] = await Promise.all([
    db.user.findUnique({ where: { id: b.ownerId }, select: { name: true, phone: true, lastLoginAt: true, createdAt: true } }),
    db.service.findMany({ where: { businessId: b.id, deleted: false }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
    db.workingHours.findMany({ where: { businessId: b.id } }),
    daysOffList(b),
    db.booking.groupBy({ by: ['status'], where: { businessId: b.id }, _count: true }),
    db.booking.aggregate({ where: { businessId: b.id, status: { in: ['confirmed', 'completed'] }, startsAt: { gt: since30, lt: now } }, _sum: { priceCents: true } }),
    db.booking.findMany({ where: { businessId: b.id, startsAt: { gt: now }, status: { in: ['confirmed', 'pending'] } }, include: { customer: true }, orderBy: { startsAt: 'asc' }, take: 100 }),
    db.booking.findMany({ where: { businessId: b.id, OR: [{ startsAt: { lte: now } }, { status: { notIn: ['confirmed', 'pending'] } }] }, include: { customer: true }, orderBy: { startsAt: 'desc' }, take: 60 }),
    db.customer.findMany({ where: { businessId: b.id }, orderBy: [{ visitsCount: 'desc' }, { createdAt: 'desc' }], take: 150 }),
    db.bookingEvent.findMany({ where: { booking: { businessId: b.id } }, include: { booking: { select: { serviceName: true, startsAt: true, customer: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 40 }),
    db.staff.findMany({ where: { businessId: b.id }, orderBy: { sort: 'asc' }, select: { name: true, active: true } }),
    db.booking.count({ where: { businessId: b.id, OR: [{ status: 'completed' }, { status: 'confirmed', endsAt: { lt: now } }] } }),
  ]);
  await audit(c.me.id, 'admin.view_business', 'business', b.id, { name: b.name });
  const st = (s: string) => statusCounts.find((x) => x.status === s)?._count || 0;
  const row = (x: (typeof upcoming)[number]) => {
    const l = toLocal(x.startsAt, tz);
    return {
      id: x.id, date: l.date, time: l.time, service: x.serviceName, priceCents: x.priceCents, source: x.source, note: x.customerNote,
      status: displayStatus(x, now), customer: x.customer.name, phone: displayPhone(x.customer.phone), createdAt: x.createdAt.toISOString(),
    };
  };
  return {
    business: {
      id: b.id, slug: b.slug, name: b.name, category: b.category, city: b.city, address: b.address, description: b.description,
      phone: displayPhone(b.phone), instagram: b.instagram, url: bookingUrl(b.slug, c.origin), createdAt: b.createdAt.toISOString(),
      onboarded: !!b.onboardedAt, paused: b.bookingsPaused, listed: b.listedInFind, approval: b.requireApproval,
      suspended: b.suspendedAt ? { at: b.suspendedAt.toISOString(), reason: b.suspendedReason } : null,
      rules: { slotStepMin: b.slotStepMin, minNoticeMin: b.minNoticeMin, maxAdvanceDays: b.maxAdvanceDays, cancelCutoffMin: b.cancelCutoffMin },
    },
    owner: owner ? { name: owner.name, phone: displayPhone(owner.phone), lastLoginAt: iso(owner.lastLoginAt), createdAt: owner.createdAt.toISOString() } : null,
    staff,
    services: services.map((s) => ({ name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, priceFrom: s.priceFrom, active: s.active })),
    hours: rowsToHours(hoursRows), daysOff,
    stats: {
      total: statusCounts.reduce((n, x) => n + x._count, 0), upcoming: upcoming.length, completed: done,
      noShows: st('no_show'), cancelled: st('cancelled_customer') + st('cancelled_business'), customers: customers.length, revenue30Cents: revenue._sum.priceCents || 0,
    },
    upcoming: upcoming.map(row), past: past.map(row),
    customers: customers.map((x) => ({
      id: x.id, name: x.name, phone: displayPhone(x.phone), visits: x.visitsCount, noShows: x.noShowCount, blocked: x.blocked,
      lastVisit: x.lastVisitAt ? toLocal(x.lastVisitAt, tz).date : null, note: x.note,
    })),
    events: events.map((e) => ({
      type: e.type, actor: e.actor, at: e.createdAt.toISOString(), customer: e.booking.customer.name, service: e.booking.serviceName,
      when: `${toLocal(e.booking.startsAt, tz).date} ${toLocal(e.booking.startsAt, tz).time}`,
    })),
  };
});

/* ---- suspend / unsuspend ------------------------------------------------------------------- */
route('POST', '/admin/businesses/:id/suspend', 'admin', async (c) => {
  const b = await bizById(c.params.id);
  const { reason } = await c.body<{ reason?: string }>();
  const clean = String(reason || '').trim().slice(0, 200);
  await db.business.update({ where: { id: b.id }, data: { suspendedAt: new Date(), suspendedReason: clean } });
  await audit(c.me.id, 'admin.suspend_business', 'business', b.id, { name: b.name, reason: clean });
  return { ok: true };
});

route('POST', '/admin/businesses/:id/unsuspend', 'admin', async (c) => {
  const b = await bizById(c.params.id);
  await db.business.update({ where: { id: b.id }, data: { suspendedAt: null, suspendedReason: '' } });
  await audit(c.me.id, 'admin.unsuspend_business', 'business', b.id, { name: b.name });
  return { ok: true };
});

/* ---- audit log -------------------------------------------------------------------------------- */
route('GET', '/admin/audit', 'admin', async () => {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 150 });
  const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))] } }, select: { id: true, name: true, phone: true } });
  return {
    entries: rows.map((r) => {
      const u = users.find((x) => x.id === r.userId);
      let meta: Record<string, unknown> = {};
      try { meta = JSON.parse(r.metaJson); } catch { /* keep empty */ }
      return { id: r.id, at: r.createdAt.toISOString(), action: r.action, targetType: r.targetType, targetId: r.targetId, who: u ? u.name || displayPhone(u.phone) : '', meta };
    }),
  };
});
