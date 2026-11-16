// Availability: loads hours, time off and bookings for a date range and answers "which start times are free".
// Rules: 01-product-design.md §5.
import type { Business, Prisma, PrismaClient, Service, WorkingHours } from '@prisma/client';
import { db } from './db';
import { slotStarts, subtract, type Interval } from './slots';
import { addDays, dayAcc, diffDays, hmToMin, localMinToUtc, minToHm, toLocal } from './time';

type Client = PrismaClient | Prisma.TransactionClient;

export type Ctx = Awaited<ReturnType<typeof loadCtx>>;

export async function loadCtx(business: Business, fromDate: string, days: number, client: Client = db) {
  const start = localMinToUtc(fromDate, 0, business.timezone);
  const end = localMinToUtc(addDays(fromDate, days), 0, business.timezone);
  const [staff, hours, timeOff, bookings] = await Promise.all([
    client.staff.findMany({ where: { businessId: business.id, active: true }, include: { services: true }, orderBy: { sort: 'asc' } }),
    client.workingHours.findMany({ where: { businessId: business.id } }),
    client.timeOff.findMany({ where: { businessId: business.id, startsAt: { lt: end }, endsAt: { gt: start } } }),
    client.booking.findMany({
      where: { businessId: business.id, status: 'confirmed', startsAt: { lt: end }, endsAt: { gt: new Date(start.getTime() - 6 * 3600e3) } },
      select: { id: true, staffId: true, startsAt: true, endsAt: true, service: { select: { bufferMin: true } } },
    }),
  ]);
  return { business, staff, hours, timeOff, bookings };
}

/** A UTC range as minutes of one local date, clipped to that day. null when it does not touch the day. */
export function rangeOnDate(startsAt: Date, endsAt: Date, date: string, tz: string): Interval | null {
  const a = toLocal(startsAt, tz), b = toLocal(endsAt, tz);
  if (a.date > date || b.date < date) return null;
  const start = a.date < date ? 0 : a.minutes;
  const end = b.date > date ? 1440 : b.minutes;
  return end > start ? { start, end } : null;
}

export function workingOn(hours: WorkingHours[], staffId: string | null, weekday: number): Interval[] {
  const own = staffId ? hours.filter((h) => h.staffId === staffId) : [];
  const rows = own.length ? own : hours.filter((h) => h.staffId === null);
  return rows.filter((h) => h.weekday === weekday).map((h) => ({ start: hmToMin(h.startLocal), end: hmToMin(h.endLocal) }));
}

function busyOn(ctx: Ctx, staffId: string, date: string, ignoreBookingId?: string): Interval[] {
  const tz = ctx.business.timezone;
  const out: Interval[] = [];
  for (const t of ctx.timeOff) {
    if (t.staffId && t.staffId !== staffId) continue;
    const r = rangeOnDate(t.startsAt, t.endsAt, date, tz);
    if (r) out.push(r);
  }
  for (const b of ctx.bookings) {
    if (b.staffId !== staffId || b.id === ignoreBookingId) continue;
    const r = rangeOnDate(b.startsAt, new Date(b.endsAt.getTime() + (b.service?.bufferMin || 0) * 60000), date, tz);
    if (r) out.push(r);
  }
  return out;
}

export function eligibleStaff(ctx: Ctx, serviceId: string, staffId?: string | null) {
  return ctx.staff.filter((s) => (!staffId || s.id === staffId) && (s.services.length === 0 || s.services.some((x) => x.serviceId === serviceId)));
}

/** Free start times for one date. Each entry lists the staff members who are free then. */
export function freeStarts(ctx: Ctx, service: Pick<Service, 'id' | 'durationMin' | 'bufferMin'>, staffId: string | null | undefined, date: string, now = new Date()) {
  const b = ctx.business;
  const todayDate = toLocal(now, b.timezone).date;
  if (date < todayDate || diffDays(todayDate, date) > b.maxAdvanceDays) return [];
  const notBefore = toLocal(new Date(now.getTime() + b.minNoticeMin * 60000), b.timezone);
  if (notBefore.date > date) return [];
  const earliestMin = notBefore.date === date ? notBefore.minutes : undefined;
  const weekday = toLocal(localMinToUtc(date, 720, b.timezone), b.timezone).weekday;

  const byTime = new Map<number, string[]>();
  for (const s of eligibleStaff(ctx, service.id, staffId)) {
    const starts = slotStarts({
      working: workingOn(ctx.hours, s.id, weekday), busy: busyOn(ctx, s.id, date),
      durationMin: service.durationMin, bufferMin: service.bufferMin, stepMin: b.slotStepMin, earliestMin,
    });
    for (const t of starts) byTime.set(t, [...(byTime.get(t) || []), s.id]);
  }
  return [...byTime.entries()].sort((x, y) => x[0] - y[0]).map(([min, staffIds]) => ({ min, time: minToHm(min), staffIds }));
}

/** true when the business does not work that date at all (closed weekday or a day off). */
export function isClosed(ctx: Ctx, date: string): boolean {
  const tz = ctx.business.timezone;
  const weekday = toLocal(localMinToUtc(date, 720, tz), tz).weekday;
  const working = workingOn(ctx.hours, null, weekday);
  if (!working.length) return true;
  const off = ctx.timeOff.filter((t) => !t.staffId && t.kind === 'holiday').map((t) => rangeOnDate(t.startsAt, t.endsAt, date, tz)).filter(Boolean) as Interval[];
  return subtract(working, off).length === 0;
}

/** "Hapur deri në 20:00" / "Mbyllur · hapet nesër në 09:00" for the booking page header. */
export function openState(ctx: Ctx, now = new Date()): { open: boolean; until?: string; opensWhen?: string; opensAt?: string } {
  const tz = ctx.business.timezone;
  const n = toLocal(now, tz);
  const free = (date: string) => {
    const weekday = toLocal(localMinToUtc(date, 720, tz), tz).weekday;
    const off = ctx.timeOff.filter((t) => !t.staffId && t.kind === 'holiday').map((t) => rangeOnDate(t.startsAt, t.endsAt, date, tz)).filter(Boolean) as Interval[];
    return subtract(workingOn(ctx.hours, null, weekday), off);
  };
  const todayFree = free(n.date);
  const cur = todayFree.find((i) => i.start <= n.minutes && n.minutes < i.end);
  if (cur) return { open: true, until: minToHm(cur.end) };
  const later = todayFree.find((i) => i.start > n.minutes);
  if (later) return { open: false, opensWhen: 'sot', opensAt: minToHm(later.start) };
  for (let d = 1; d <= 7; d++) {
    const date = addDays(n.date, d);
    const f = free(date);
    if (f.length) return { open: false, opensWhen: d === 1 ? 'nesër' : dayAcc(date), opensAt: minToHm(f[0].start) };
  }
  return { open: false };
}
