// "To confirm" (pending) bookings. Shared by booking.ts and availability.ts.
//   v5: the spam guard accepts a burst of new numbers as pending instead of refusing them (hold: 2 hours).
//   v6: a business can switch on "approve every booking"; then every online booking is pending (hold: 12 hours).
// A pending booking holds its slot until `pendingUntil` (or its start time, whichever comes first).
// Rows from v5 have no pendingUntil: for them the hold is createdAt + 2 hours.
import type { Booking, Prisma } from '@prisma/client';

/** v5 spam guard: a "to confirm" booking holds its slot this long. */
export const PENDING_HOLD_MS = 2 * 3600e3;
/** v6 "approve every booking": the owner has this long to answer. */
export const APPROVAL_HOLD_MS = 12 * 3600e3;

/** When a pending booking created now stops holding its slot (never after the start time). */
export function holdUntil(kind: 'spam' | 'approval', startsAt: Date, now = new Date()): Date {
  const ms = now.getTime() + (kind === 'approval' ? APPROVAL_HOLD_MS : PENDING_HOLD_MS);
  return new Date(Math.min(ms, startsAt.getTime()));
}

/** The moment a pending booking is released. */
export function pendingEnds(b: Pick<Booking, 'createdAt' | 'startsAt'> & { pendingUntil?: Date | null }): Date {
  const until = b.pendingUntil ? b.pendingUntil.getTime() : b.createdAt.getTime() + PENDING_HOLD_MS;
  return new Date(Math.min(until, b.startsAt.getTime()));
}

/** True while a pending booking still holds its slot. */
export function pendingAlive(b: Pick<Booking, 'status' | 'createdAt' | 'startsAt'> & { pendingUntil?: Date | null }, now = new Date()): boolean {
  return b.status === 'pending' && pendingEnds(b).getTime() > now.getTime();
}

/** Prisma filter: live pending bookings (any date). */
export function pendingLive(now = new Date()): Prisma.BookingWhereInput {
  return {
    status: 'pending', startsAt: { gt: now },
    OR: [{ pendingUntil: { gt: now } }, { pendingUntil: null, createdAt: { gt: new Date(now.getTime() - PENDING_HOLD_MS) } }],
  };
}

/** Prisma filter: bookings that block a slot (confirmed, or pending and not yet expired). */
export function holdsSlot(now = new Date()): Prisma.BookingWhereInput {
  return { OR: [{ status: 'confirmed' }, pendingLive(now)] };
}
