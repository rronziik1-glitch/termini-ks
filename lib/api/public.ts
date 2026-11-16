// Public API: customers (no account) and login. §8.1, §8.2.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_DAYS, destroySession, requestCode, verifyCode } from '../auth';
import { freeStarts, isClosed, loadCtx } from '../availability';
import { bookingIcs, cancelByToken, createPublicBooking, displayStatus, getByToken } from '../booking';
import { findBusinesses } from '../business';
import { AppError, db } from '../db';
import { readStored } from '../fg/images';
import { cookieValue, route, type Ctx } from '../http';
import { sq } from '../sq';
import { addDays, isDate, toLocal } from '../time';

async function bizBySlug(slug: string) {
  const b = await db.business.findUnique({ where: { slug } });
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  return b;
}

async function serviceOf(businessId: string, id: string | null) {
  const s = id ? await db.service.findFirst({ where: { id, businessId, active: true, deleted: false } }) : null;
  if (!s) throw new AppError('bad_request', 400, sq.errors.bad_request);
  return s;
}

route('GET', '/public/businesses/:slug/days', 'public', async (c: Ctx) => {
  const b = await bizBySlug(c.params.slug);
  const service = await serviceOf(b.id, c.query.get('service_id'));
  const today = toLocal(new Date(), b.timezone).date;
  const from = isDate(c.query.get('from')) ? c.query.get('from')! : today;
  const n = Math.min(31, Math.max(1, Number(c.query.get('days')) || 14));
  const ctx = await loadCtx(b, from, n);
  const staffId = c.query.get('staff_id') || null;
  const days = Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    const closed = isClosed(ctx, date);
    return { date, closed, free_count: closed || b.bookingsPaused ? 0 : freeStarts(ctx, service, staffId, date).length };
  });
  return { today, days };
});

route('GET', '/public/businesses/:slug/slots', 'public', async (c) => {
  const b = await bizBySlug(c.params.slug);
  const service = await serviceOf(b.id, c.query.get('service_id'));
  const date = c.query.get('date');
  if (!isDate(date)) throw new AppError('bad_request', 400, sq.errors.bad_request);
  if (b.bookingsPaused) return { date, slots: [] };
  const ctx = await loadCtx(b, date, 1);
  return { date, slots: freeStarts(ctx, service, c.query.get('staff_id') || null, date).map((s) => s.time) };
});

route('POST', '/public/businesses/:slug/bookings', 'public', async (c) => {
  const b = await bizBySlug(c.params.slug);
  const body = await c.body<Record<string, string>>();
  const booking = await createPublicBooking(b, {
    serviceId: body.service_id, staffId: body.staff_id || null, date: body.date, time: body.time,
    name: body.name, phone: body.phone, note: body.note, source: body.source, website: body.website, ip: c.ip,
  });
  return { token: booking.token };
});

route('GET', '/public/bookings/:token', 'public', async (c) => {
  const b = await getByToken(c.params.token);
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  const l = toLocal(b.startsAt, b.business.timezone);
  return { status: displayStatus(b), service: b.serviceName, date: l.date, time: l.time, business: b.business.name, slug: b.business.slug, price_cents: b.priceCents };
});

route('POST', '/public/bookings/:token/cancel', 'public', async (c) => {
  const b = await cancelByToken(c.params.token);
  return { status: b.status };
});

route('GET', '/public/bookings/:token/calendar.ics', 'public', async (c) => {
  const b = await getByToken(c.params.token);
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  return new Response(bookingIcs(b, c.origin), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="termini.ics"' } });
});

route('GET', '/public/find', 'public', async (c) => ({ businesses: await findBusinesses(c.query.get('city') || undefined, c.query.get('category') || undefined) }));

route('GET', '/public/businesses/:slug/photo', 'public', async (c) => {
  const b = await bizBySlug(c.params.slug);
  const data = await readStored(`biz/${b.id}.jpg`);
  if (!data) throw new AppError('not_found', 404, sq.errors.not_found);
  return new Response(new Uint8Array(data), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' } });
});

/* ---- auth ----------------------------------------------------------------------- */
route('POST', '/auth/code', 'public', async (c) => {
  const { phone } = await c.body<{ phone: string }>();
  const r = await requestCode(phone, c.ip);
  return { phone: r.phone, dev_code: r.devCode };
});

route('POST', '/auth/verify', 'public', async (c) => {
  const body = await c.body<{ phone: string; code: string; name?: string }>();
  const { user, token } = await verifyCode(body.phone, body.code, body.name);
  const business = await db.business.findFirst({ where: { ownerId: user.id }, select: { slug: true } });
  const res = NextResponse.json({ user: { id: user.id, name: user.name, role: user.role }, has_business: !!business });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: c.origin.startsWith('https://'), path: '/', maxAge: SESSION_DAYS * 86400 });
  return res;
});

route('POST', '/auth/logout', 'public', async (c) => {
  await destroySession(cookieValue(c.req, SESSION_COOKIE));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
});

route('GET', '/me', 'public', async (c) => ({
  user: c.user ? { id: c.user.id, name: c.user.name, phone: c.user.phone, role: c.user.role } : null,
  business: c.business ? { id: c.business.id, slug: c.business.slug, name: c.business.name } : null,
}));
