// v5: "to confirm" bookings (spam guard accepts instead of refusing). Shared by booking.ts and availability.ts.
import type { Booking, Prisma } from '@prisma/client';

/** v5: a "to confirm" booking holds its slot this long; after that (or once its start time passes) it is released. */
export const PENDING_HOLD_MS = 2 * 3600e3;

/** True while a pending booking still holds its slot. */
export function pendingAlive(b: Pick<Booking, 'status' | 'createdAt' | 'startsAt'>, now = new Date()): boolean {
  return b.status === 'pending' && b.createdAt.getTime() + PENDING_HOLD_MS > now.getTime() && b.startsAt.getTime() > now.getTime();
}

/** Prisma filter: bookings that block a slot (confirmed, or pending and not yet expired). */
export function holdsSlot(now = new Date()): Prisma.BookingWhereInput {
  return { OR: [{ status: 'confirmed' }, { status: 'pending', createdAt: { gt: new Date(now.getTime() - PENDING_HOLD_MS) }, startsAt: { gt: now } }] };
}

