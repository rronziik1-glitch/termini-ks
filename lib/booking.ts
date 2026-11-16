// Bookings: create (customer and owner), cancel, status, move, WhatsApp links. Rules: 01-product-design.md §5.
import type { Booking, Business, Customer, Prisma } from '@prisma/client';
import { AppError, db, lockKey, withLock } from './db';
import { bookingTokenUrl, bookingUrl, ipHash, randomId } from './config';
import { freeStarts, loadCtx } from './availability';
import { displayPhone, normalizePhone, waDigits } from './phone';
import { sq } from './sq';
import { holdsSlot, pendingAlive } from './pending';
export { holdsSlot, pendingAlive, PENDING_HOLD_MS } from './pending';
import { dayAcc, diffDays, fmtDateLong, fmtDayMonth, fmtDuration, isDate, isTime, localToUtc, toLocal } from './time';

type Tx = Prisma.TransactionClient;
export const MAX_ACTIVE_PER_PHONE = 3;
const AUTO_COMPLETE_MS = 2 * 3600e3;

/** A confirmed booking that ended more than 2 hours ago is shown as completed; an expired "to confirm" one as expired. */
export function displayStatus(b: Pick<Booking, 'status' | 'endsAt'> & Partial<Pick<Booking, 'createdAt' | 'startsAt'>>, now = new Date()): string {
  if (b.status === 'confirmed' && b.endsAt.getTime() + AUTO_COMPLETE_MS < now.getTime()) return 'completed';
  if (b.status === 'pending' && b.createdAt && b.startsAt && !pendingAlive(b as Booking, now)) return 'expired';
  return b.status;
}

async function logEvent(tx: Tx, bookingId: string, type: string, actor: string, meta: object = {}) {
  await tx.bookingEvent.create({ data: { bookingId, type, actor, metaJson: JSON.stringify(meta) } });
}

/** Visits and no-shows are always recounted from the bookings, so undo never leaves a wrong number. */
export async function recountCustomer(tx: Tx, customerId: string, now = new Date()) {
  const rows = await tx.booking.findMany({ where: { customerId }, select: { status: true, startsAt: true, endsAt: true } });
  const visits = rows.filter((r) => r.status === 'completed' || (r.status === 'confirmed' && r.endsAt < now));
  const last = visits.reduce<Date | null>((m, r) => (!m || r.startsAt > m ? r.startsAt : m), null);
  await tx.customer.update({
    where: { id: customerId },
    data: { visitsCount: visits.length, noShowCount: rows.filter((r) => r.status === 'no_show').length, lastVisitAt: last },
  });
}

/** At most this many bookings from new numbers per business in NEW_NUMBER_WINDOW_MS. */
export const MAX_NEW_NUMBERS_PER_WINDOW = 6;
export const NEW_NUMBER_WINDOW_MS = 30 * 60e3;

export type PublicBookingInput = {
  serviceId: string; staffId?: string | null; date: string; time: string; name: string; phone: string;
  note?: string; source?: string; ip?: string; website?: string; now?: Date; skipRateLimit?: boolean;
};

/** Customer booking from the public link. Throws AppError with an Albanian message. */
export async function createPublicBooking(business: Business, input: PublicBookingInput) {
  const now = input.now ?? new Date();
  if (input.website) throw new AppError('bad_request', 400, sq.errors.bad_request);                 // honeypot
  const iph = ipHash(input.ip || 'local');
  // v4 audit: counted from the bookings table (the in-memory counter was per server instance). At most 5 an hour per IP.
  if (!input.skipRateLimit && input.ip && input.ip !== 'local') {
    const recent = await db.booking.count({ where: { createdIpHash: iph, createdAt: { gt: new Date(now.getTime() - 3600e3) } } });
    if (recent >= 5) throw new AppError('rate_limited', 429, sq.errors.rate_limited);
  }
  if (business.bookingsPaused) throw new AppError('paused', 409, sq.errors.paused(business.name, displayPhone(business.phone)));
  const name = (input.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (name.length < 2) throw new AppError('name_required', 422, sq.errors.name_required);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
  if (!isDate(input.date) || !isTime(input.time)) throw new AppError('bad_request', 400, sq.errors.bad_request);
  const service = await db.service.findFirst({ where: { id: input.serviceId, businessId: business.id, active: true, deleted: false } });
  if (!service) throw new AppError('slot_taken', 409, sq.errors.slot_taken);
  const source = ['link', 'page', 'find'].includes(input.source || '') ? input.source! : 'link';

  return withLock(`biz:${business.id}`, () =>
    db.$transaction(async (tx) => {
      await lockKey(tx, `biz:${business.id}`);
      const existing = await tx.customer.findUnique({ where: { businessId_phone: { businessId: business.id, phone } } });
      if (existing?.blocked) throw new AppError('blocked', 403, sq.errors.blocked);
      if (existing) {
        const active = await tx.booking.count({ where: { customerId: existing.id, startsAt: { gt: now }, ...holdsSlot(now) } });
        if (active >= MAX_ACTIVE_PER_PHONE) throw new AppError('too_many_active', 429, sq.errors.too_many_active);
      }
      // Spam guard (audit H3, v5): a burst of bookings from brand-new numbers could fill a day with fake customers.
      // Real customers from an Instagram story must never be turned away, so above the limit the booking is accepted
      // as "pending" (holds the slot for PENDING_HOLD_MS) and the owner confirms or refuses it.
      let pending = false;
      if (!existing && !input.skipRateLimit) {
        const fresh = await tx.customer.count({ where: { businessId: business.id, createdAt: { gt: new Date(now.getTime() - NEW_NUMBER_WINDOW_MS) } } });
        if (fresh >= MAX_NEW_NUMBERS_PER_WINDOW) pending = true;
      }
      // Re-check the slot inside the transaction: this is what prevents double bookings.
      const ctx = await loadCtx(business, input.date, 1, tx);
      const slot = freeStarts(ctx, service, input.staffId || null, input.date, now).find((s) => s.time === input.time);
      if (!slot) throw new AppError('slot_taken', 409, sq.errors.slot_taken);
      // "Any staff": the free one with the fewest bookings that day.
      const load = (id: string) => ctx.bookings.filter((b) => b.staffId === id).length;
      const staffId = [...slot.staffIds].sort((a, b) => load(a) - load(b))[0];

      const customer = existing
        ? await tx.customer.update({ where: { id: existing.id }, data: { name } })
        : await tx.customer.create({ data: { businessId: business.id, phone, name } });
      const startsAt = localToUtc(input.date, input.time, business.timezone);
      const booking = await tx.booking.create({
        data: {
          businessId: business.id, staffId, serviceId: service.id, customerId: customer.id,
          startsAt, endsAt: new Date(startsAt.getTime() + service.durationMin * 60000),
          source, serviceName: service.name, priceCents: service.priceCents,
          customerNote: (input.note || '').trim().slice(0, 300), token: randomId(22), createdIpHash: iph,
          status: pending ? 'pending' : 'confirmed', createdAt: now,
        },
      });
      await logEvent(tx, booking.id, 'created', 'customer', { source, pending });
      return booking;
    }),
  );
}

export type ManualBookingInput = { serviceId: string; date: string; time: string; name: string; phone?: string; force?: boolean };

/** Booking added by the owner (phone call, walk-in). The owner may overbook with force. */
export async function createManualBooking(business: Business, input: ManualBookingInput) {
  const name = (input.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (name.length < 2) throw new AppError('name_required', 422, sq.errors.name_required);
  let phone: string | null = null;
  if (input.phone && input.phone.trim()) {
    phone = normalizePhone(input.phone);
    if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
  }
  if (!isDate(input.date) || !isTime(input.time)) throw new AppError('bad_request', 400, sq.errors.bad_request);
  const service = await db.service.findFirst({ where: { id: input.serviceId, businessId: business.id, deleted: false } });
  if (!service) throw new AppError('bad_request', 400, sq.errors.bad_request);
  const staff = await db.staff.findFirst({ where: { businessId: business.id, active: true }, orderBy: { sort: 'asc' } });
  if (!staff) throw new AppError('bad_request', 400, sq.errors.bad_request);
  const startsAt = localToUtc(input.date, input.time, business.timezone);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

  return withLock(`biz:${business.id}`, () =>
    db.$transaction(async (tx) => {
      await lockKey(tx, `biz:${business.id}`);
      if (!input.force) {
        const clash = await tx.booking.findFirst({
          where: { businessId: business.id, staffId: staff.id, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...holdsSlot() },
          include: { customer: true },
        });
        if (clash) throw new AppError('overlap', 409, sq.errors.overlap(clash.customer.name));
      }
      let customer: Customer | null = null;
      if (phone) {
        customer = await tx.customer.findUnique({ where: { businessId_phone: { businessId: business.id, phone } } });
        if (!customer) customer = await tx.customer.create({ data: { businessId: business.id, phone, name } });
      } else {
        customer = await tx.customer.findFirst({ where: { businessId: business.id, phone: null, name } });
        if (!customer) customer = await tx.customer.create({ data: { businessId: business.id, name } });
      }
      const booking = await tx.booking.create({
        data: {
          businessId: business.id, staffId: staff.id, serviceId: service.id, customerId: customer.id, startsAt, endsAt,
          source: 'manual', serviceName: service.name, priceCents: service.priceCents, token: randomId(22),
        },
      });
      await logEvent(tx, booking.id, 'created', 'owner');
      await recountCustomer(tx, customer.id);
      return booking;
    }),
  );
}

export async function getByToken(token: string) {
  return db.booking.findUnique({ where: { token }, include: { business: true, service: true, customer: true } });
}

/** Customer cancel with the booking token, until cancel_cutoff_min before the start. */
export async function cancelByToken(token: string, now = new Date()) {
  const b = await getByToken(token);
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  if (b.status !== 'confirmed' && !pendingAlive(b, now)) return b;
  const cutoff = b.business.cancelCutoffMin;
  if (b.startsAt.getTime() - now.getTime() < cutoff * 60000) {
    throw new AppError('too_late', 409, sq.errors.too_late(fmtDuration(cutoff), displayPhone(b.business.phone)));
  }
  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: b.id }, data: { status: 'cancelled_customer', cancelledAt: now } });
    await logEvent(tx, b.id, 'cancelled', 'customer');
    await recountCustomer(tx, b.customerId, now);
  });
  return { ...b, status: 'cancelled_customer' };
}

const OWNER_STATUSES = ['confirmed', 'completed', 'no_show', 'cancelled_business'];

/** Owner changes: status (also back to confirmed for undo) and/or a move to another day and time. */
export async function updateBooking(business: Business, id: string, patch: { status?: string; date?: string; time?: string }) {
  const b = await db.booking.findFirst({ where: { id, businessId: business.id } });
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  const data: Prisma.BookingUpdateInput = {};
  const events: [string, object][] = [];
  if (patch.status !== undefined) {
    if (!OWNER_STATUSES.includes(patch.status)) throw new AppError('bad_request', 400, sq.errors.bad_request);
    data.status = patch.status;
    data.cancelledAt = patch.status === 'cancelled_business' ? new Date() : null;
    const kind = patch.status === 'cancelled_business' ? (b.status === 'pending' ? 'refused' : 'cancelled')
      : patch.status === 'confirmed' ? (b.status === 'pending' ? 'confirmed' : 'moved') : patch.status;
    events.push([kind, { from: b.status }]);
  }
  if (patch.date !== undefined || patch.time !== undefined) {
    if (!isDate(patch.date) || !isTime(patch.time)) throw new AppError('bad_request', 400, sq.errors.bad_request);
    const startsAt = localToUtc(patch.date, patch.time, business.timezone);
    data.startsAt = startsAt;
    data.endsAt = new Date(startsAt.getTime() + (b.endsAt.getTime() - b.startsAt.getTime()));
    data.reminderSentAt = null;
    events.push(['moved', { from: b.startsAt.toISOString() }]);
  }
  // Audit fix: moving a booking, or restoring a cancelled/no-show one to "confirmed" (undo), used to skip the overlap
  // check, so the slot could already belong to a customer who booked it in the meantime → silent double booking.
  const finalStatus = (data.status as string | undefined) ?? b.status;
  const needsCheck = finalStatus === 'confirmed' && (data.startsAt !== undefined || b.status.startsWith('cancelled') || b.status === 'pending');
  const startsAt = (data.startsAt as Date | undefined) ?? b.startsAt;
  const endsAt = (data.endsAt as Date | undefined) ?? b.endsAt;
  return withLock(`biz:${business.id}`, () => db.$transaction(async (tx) => {
    await lockKey(tx, `biz:${business.id}`);
    if (needsCheck) {
      const clash = await tx.booking.findFirst({
        where: { businessId: business.id, staffId: b.staffId, id: { not: id }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...holdsSlot() },
        include: { customer: true },
      });
      if (clash) throw new AppError('overlap', 409, sq.errors.overlap(clash.customer.name));
    }
    const updated = await tx.booking.update({ where: { id }, data });
    for (const [type, meta] of events) await logEvent(tx, id, type, 'owner', meta);
    await recountCustomer(tx, b.customerId);
    return updated;
  }));
}

/* ---- WhatsApp click-to-chat (the free reminder channel) -------------------- */
export const waLink = (e164OrDigits: string, text: string) => `https://wa.me/${waDigits(e164OrDigits)}?text=${encodeURIComponent(text)}`;

type FullBooking = Booking & { business: Business; customer: Customer };

/** Message A: customer → business, from the confirmation screen. */
export function customerConfirmLink(b: FullBooking, origin?: string) {
  const l = toLocal(b.startsAt, b.business.timezone);
  const text = sq.wa.customerConfirm({ service: b.serviceName, date: fmtDateLong(l.date), time: l.time, name: b.customer.name, link: bookingTokenUrl(b.business.slug, b.token, origin) });
  return waLink(b.business.whatsapp || b.business.phone, text);
}

/** Messages B–E: business → customer. Returns null for walk-ins without a number. */
export function ownerMessage(b: FullBooking, type: string, origin?: string, now = new Date()): { url: string; text: string } | null {
  if (!b.customer.phone) return null;
  const tz = b.business.timezone;
  const l = toLocal(b.startsAt, tz);
  const first = b.customer.name.split(' ')[0];
  const link = bookingUrl(b.business.slug, origin);
  const tokenLink = bookingTokenUrl(b.business.slug, b.token, origin);
  const date = fmtDateLong(l.date);
  // Audit fix: inside a sentence the day needs the accusative ("të premten më 14 nëntor"), not the list form
  // "e premte, 14 nëntor" ("termini yt e premte, 14 nëntor në 10:00" was ungrammatical).
  const dateInSentence = `${dayAcc(l.date)} më ${fmtDayMonth(l.date)}`;
  let text: string;
  if (type === 'confirm') text = sq.wa.manualConfirm({ name: first, business: b.business.name, service: b.serviceName, date, time: l.time, link });
  else if (type === 'cancel') text = sq.wa.cancelled({ name: first, date: dateInSentence, time: l.time, business: b.business.name, link });
  else if (type === 'noshow') text = sq.wa.noShow({ name: first, time: l.time, link });
  else {
    const n = diffDays(toLocal(now, tz).date, l.date);
    const when = n === 0 ? 'sot' : n === 1 ? 'nesër' : dateInSentence;
    text = sq.wa.reminder({ name: first, when, time: l.time, business: b.business.name, link: tokenLink });
  }
  return { url: waLink(b.customer.phone, text), text };
}

/** Sends (for now: logs) a reminder and marks it. Interface point for WhatsApp Business API / SMS later. */
export async function recordMessage(b: FullBooking, type: string, text: string) {
  // TODO(production): when REMINDER_CHANNEL is "whatsapp_api" or "sms", send `text` here instead of
  // relying on the owner tapping the wa.me link (WhatsApp Cloud API: POST /{phone-number-id}/messages).
  console.log(`[reminder:${type}] → ${b.customer.phone}\n${text}\n`);
  await db.$transaction(async (tx) => {
    if (type === 'reminder') await tx.booking.update({ where: { id: b.id }, data: { reminderSentAt: new Date() } });
    await logEvent(tx, b.id, type === 'reminder' ? 'reminder_sent' : 'whatsapp_opened', 'owner', { type });
  });
}

/** Calendar file for "Shto në kalendar". */
export function bookingIcs(b: FullBooking, origin?: string): string {
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Termini//sq', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${b.token}@termini`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(b.startsAt)}`, `DTEND:${z(b.endsAt)}`,
    `SUMMARY:${esc(`${b.serviceName} te ${b.business.name}`)}`,
    `LOCATION:${esc([b.business.address, b.business.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc(bookingTokenUrl(b.business.slug, b.token, origin))}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Termin', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
