// v6 "Rezervimet e mia": a customer proves their phone with a login code and then sees every booking made with
// that number, at every business. Customers have no account: the proof is a signed cookie that holds the phone
// number and an expiry (no database row). Changing APP_SECRET logs every customer out.
import { timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { sha } from './config';
import { displayStatus } from './booking';
import { displayPhone } from './phone';
import { toLocal } from './time';

export const CLIENT_COOKIE = 't_client';
export const CLIENT_HOURS = 24;

const sign = (phone: string, exp: number) => sha(`client:${phone}:${exp}`).slice(0, 40);

export function clientCookie(phone: string, now = Date.now()): string {
  const exp = now + CLIENT_HOURS * 3600e3;
  return `${Buffer.from(phone).toString('base64url')}.${exp}.${sign(phone, exp)}`;
}

/** The verified phone in the cookie, or null when missing, forged or expired. */
export function clientPhone(cookie: string | undefined | null, now = Date.now()): string | null {
  if (!cookie) return null;
  const [p, e, mac] = cookie.split('.');
  if (!p || !e || !mac) return null;
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp < now) return null;
  let phone: string;
  try { phone = Buffer.from(p, 'base64url').toString('utf8'); } catch { return null; }
  if (!/^\+\d{8,15}$/.test(phone)) return null;
  const want = Buffer.from(sign(phone, exp)), got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? phone : null;
}

/** Bookings for one phone number at every (not suspended) business: upcoming first, then the last 30. */
export async function clientBookings(phone: string, now = new Date()) {
  const rows = await db.booking.findMany({
    where: { customer: { phone }, business: { suspendedAt: null } },
    include: { business: { select: { name: true, slug: true, timezone: true, phone: true, address: true, city: true } } },
    orderBy: { startsAt: 'desc' }, take: 80,
  });
  const map = (b: (typeof rows)[number]) => {
    const l = toLocal(b.startsAt, b.business.timezone);
    return {
      token: b.token, date: l.date, time: l.time, service: b.serviceName, priceCents: b.priceCents,
      status: displayStatus(b, now), business: b.business.name, slug: b.business.slug,
      place: [b.business.address, b.business.city].filter(Boolean).join(', '), businessPhone: displayPhone(b.business.phone),
    };
  };
  const upcoming = rows.filter((b) => b.startsAt > now && ['confirmed', 'pending'].includes(displayStatus(b, now))).reverse().map(map);
  const past = rows.filter((b) => !(b.startsAt > now && ['confirmed', 'pending'].includes(displayStatus(b, now)))).slice(0, 30).map(map);
  return { phone: displayPhone(phone), upcoming, past };
}
