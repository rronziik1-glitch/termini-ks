// v6: roles. Super Admin (phone in ADMIN_PHONES), business owner ("approve every booking"), customer ("Rezervimet e mia").
import type { Business, Service } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import '../lib/api/public';
import '../lib/api/owner';
import '../lib/api/pages';
import '../lib/api/admin';
import { createSession, isSuperAdmin, requestCode, verifyCode } from '../lib/auth';
import { APPROVAL_HOLD_MS, createPublicBooking, displayStatus, updateBooking } from '../lib/booking';
import { freeStarts, loadCtx } from '../lib/availability';
import { createBusiness, defaultHours, findBusinesses } from '../lib/business';
import { clientBookings, clientCookie, clientPhone } from '../lib/client-session';
import { randomId } from '../lib/config';
import { db } from '../lib/db';
import { dispatch } from '../lib/http';
import { addDays, toLocal, weekdayOf } from '../lib/time';

const now = new Date();
let biz: Business;
let other: Business;
let cut: Service;
let day: string;
const ADMIN = '+38349777001';
const uniq = () => `+38344${String(Math.floor(Math.random() * 900000) + 100000)}`;

beforeAll(async () => {
  const owner = await db.user.create({ data: { phone: uniq(), name: 'Pronari v6' } });
  biz = await createBusiness(owner, { name: `Roles Test ${randomId(5)}`, category: 'berber', city: 'Pejë', services: [{ name: 'Qethje', durationMin: 30, price: 5 }], hours: defaultHours('berber') });
  await db.business.update({ where: { id: biz.id }, data: { onboardedAt: new Date() } });
  const owner2 = await db.user.create({ data: { phone: uniq(), name: 'Pronari 2' } });
  other = await createBusiness(owner2, { name: `Roles Other ${randomId(5)}`, category: 'berber', city: 'Pejë', services: [{ name: 'Rruajtje', durationMin: 30, price: 4 }], hours: defaultHours('berber') });
  cut = (await db.service.findFirst({ where: { businessId: biz.id } }))!;
  const today = toLocal(now, biz.timezone).date;
  day = addDays(today, 8 - weekdayOf(today)); // next Monday
});
afterAll(() => { vi.unstubAllEnvs(); });

const req = (path: string, opts: { method?: string; cookie?: string; body?: unknown } = {}) =>
  dispatch(new Request(`http://localhost/api/${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { host: 'localhost', ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }), path.split('?')[0].split('/'));

describe('v6: business owner, "approve every booking"', () => {
  it('every online booking waits for the owner, holds the time up to 12 hours, and Konfirmo makes it final', async () => {
    await db.business.update({ where: { id: biz.id }, data: { requireApproval: true } });
    const b = await createPublicBooking({ ...biz, requireApproval: true }, { serviceId: cut.id, date: day, time: '10:00', name: 'Klient Aprovimi', phone: uniq(), now });
    expect(b.status).toBe('pending');
    const hold = b.pendingUntil!.getTime() - now.getTime();
    expect(hold).toBeGreaterThan(APPROVAL_HOLD_MS - 5000);
    expect(hold).toBeLessThanOrEqual(APPROVAL_HOLD_MS);
    const ctx = await loadCtx(biz, day, 1);
    expect(freeStarts(ctx, cut, null, day, now).map((s) => s.time)).not.toContain('10:00');
    // 11 hours later it still holds; 13 hours later it has expired.
    expect(displayStatus(b, new Date(now.getTime() + 11 * 3600e3))).toBe('pending');
    expect(displayStatus(b, new Date(now.getTime() + 13 * 3600e3))).toBe('expired');
    await updateBooking(biz, b.id, { status: 'confirmed' });
    const after = (await db.booking.findUnique({ where: { id: b.id } }))!;
    expect(after.status).toBe('confirmed');
    expect(after.pendingUntil).toBeNull();
    await db.business.update({ where: { id: biz.id }, data: { requireApproval: false } });
  });

  it('a pending hold never lasts past the start of the appointment', async () => {
    const { holdUntil } = await import('../lib/pending');
    const soon = new Date(now.getTime() + 3 * 3600e3);
    expect(holdUntil('approval', soon, now).getTime()).toBe(soon.getTime());
  });

  it('the owner can switch it on and off from settings', async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { id: biz.ownerId } });
    const token = await createSession(owner.id);
    const on = await req('business', { method: 'PATCH', cookie: `t_session=${token}`, body: { requireApproval: true } });
    expect(on.status).toBe(200);
    expect((await db.business.findUniqueOrThrow({ where: { id: biz.id } })).requireApproval).toBe(true);
    await req('business', { method: 'PATCH', cookie: `t_session=${token}`, body: { requireApproval: false } });
    expect((await db.business.findUniqueOrThrow({ where: { id: biz.id } })).requireApproval).toBe(false);
  });
});

describe('v6: Super Admin', () => {
  it('is only the phone in ADMIN_PHONES, checked on every request (removing the number removes the power)', async () => {
    vi.stubEnv('ADMIN_PHONES', ADMIN);
    expect(isSuperAdmin({ role: 'admin', phone: ADMIN })).toBe(true);
    expect(isSuperAdmin({ role: 'admin', phone: '+38349000001' })).toBe(false);   // stale role from the past
    expect(isSuperAdmin({ role: 'owner', phone: ADMIN })).toBe(false);
    vi.stubEnv('ADMIN_PHONES', '');
    expect(isSuperAdmin({ role: 'admin', phone: ADMIN })).toBe(false);
  });

  it('a number removed from ADMIN_PHONES is demoted to owner at its next login', async () => {
    const phone = uniq();
    await db.user.create({ data: { phone, role: 'admin' } });
    vi.stubEnv('ADMIN_PHONES', '');
    vi.stubEnv('OTP_PROVIDER', 'dev');
    const r = await requestCode(phone);
    expect(r.devCode).toMatch(/^\d{6}$/);
    const { user } = await verifyCode(phone, r.devCode!);
    expect(user.role).toBe('owner');
    vi.unstubAllEnvs();
  });

  it('owners get 403 on every Super Admin route; the admin sees overview, businesses, one business and the audit log', async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { id: biz.ownerId } });
    const ownerCookie = `t_session=${await createSession(owner.id)}`;
    for (const p of ['admin/overview', 'admin/businesses', `admin/businesses/${biz.id}`, 'admin/audit']) {
      expect((await req(p, { cookie: ownerCookie })).status).toBe(403);
    }
    expect((await req(`admin/businesses/${biz.id}/suspend`, { cookie: ownerCookie, body: { reason: 'x' } })).status).toBe(403);

    vi.stubEnv('ADMIN_PHONES', ADMIN);
    const admin = await db.user.upsert({ where: { phone: ADMIN }, update: { role: 'admin' }, create: { phone: ADMIN, role: 'admin', name: 'Roni' } });
    const cookie = `t_session=${await createSession(admin.id)}`;
    const ov = await (await req('admin/overview', { cookie })).json();
    expect(ov.businesses.total).toBeGreaterThanOrEqual(2);
    expect(ov.signups).toHaveLength(14);
    const list = await (await req(`admin/businesses?q=${encodeURIComponent('Roles Test')}`, { cookie })).json();
    expect(list.businesses.map((b: { id: string }) => b.id)).toContain(biz.id);
    const one = await (await req(`admin/businesses/${biz.id}`, { cookie })).json();
    expect(one.business.name).toBe(biz.name);
    expect(one.services[0].name).toBe('Qethje');
    const log = await (await req('admin/audit', { cookie })).json();
    expect(log.entries.some((e: { action: string; targetId: string }) => e.action === 'admin.view_business' && e.targetId === biz.id)).toBe(true);
    vi.unstubAllEnvs();
  });

  it('a suspended business disappears from the public (booking, search) until it is brought back', async () => {
    vi.stubEnv('ADMIN_PHONES', ADMIN);
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN } });
    const cookie = `t_session=${await createSession(admin.id)}`;
    expect((await req(`admin/businesses/${other.id}/suspend`, { cookie, body: { reason: 'Biznes i rremë' } })).status).toBe(200);
    const s = await db.business.findUniqueOrThrow({ where: { id: other.id } });
    expect(s.suspendedAt).not.toBeNull();
    expect(s.suspendedReason).toBe('Biznes i rremë');
    const svc = (await db.service.findFirst({ where: { businessId: other.id } }))!;
    await expect(createPublicBooking(s, { serviceId: svc.id, date: day, time: '11:00', name: 'Dikush', phone: uniq(), now })).rejects.toMatchObject({ code: 'not_found' });
    expect((await req(`public/businesses/${other.slug}/slots?service_id=${svc.id}&date=${day}`)).status).toBe(404);
    await db.business.update({ where: { id: other.id }, data: { onboardedAt: new Date() } });
    expect((await findBusinesses('Pejë', undefined, now)).map((b) => b.slug)).not.toContain(other.slug);
    expect((await req(`admin/businesses/${other.id}/unsuspend`, { cookie, body: {} })).status).toBe(200);
    expect((await db.business.findUniqueOrThrow({ where: { id: other.id } })).suspendedAt).toBeNull();
    const actions = (await db.auditLog.findMany({ where: { targetId: other.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['admin.suspend_business', 'admin.unsuspend_business']));
    vi.unstubAllEnvs();
  });
});

describe('v6: customer, "Rezervimet e mia"', () => {
  it('the signed cookie proves the number and cannot be forged or reused after it expires', () => {
    const c = clientCookie('+38349123456');
    expect(clientPhone(c)).toBe('+38349123456');
    const [, exp, mac] = c.split('.');
    const forged = `${Buffer.from('+38349999999').toString('base64url')}.${exp}.${mac}`;
    expect(clientPhone(forged)).toBeNull();
    expect(clientPhone(c, Date.now() + 25 * 3600e3)).toBeNull();
    expect(clientPhone('garbage')).toBeNull();
  });

  it('shows every booking made with that number at every business, never other numbers', async () => {
    const mine = uniq(), theirs = uniq();
    await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '13:00', name: 'Une', phone: mine, now, skipRateLimit: true });
    const svc2 = (await db.service.findFirst({ where: { businessId: other.id } }))!;
    await createPublicBooking({ ...other, suspendedAt: null }, { serviceId: svc2.id, date: day, time: '13:00', name: 'Une', phone: mine, now, skipRateLimit: true });
    await createPublicBooking(biz, { serviceId: cut.id, date: day, time: '14:00', name: 'Tjetri', phone: theirs, now, skipRateLimit: true });
    const r = await clientBookings(mine, now);
    expect(r.upcoming.map((b) => b.business).sort()).toEqual([biz.name, other.name].sort());
    expect(r.upcoming.every((b) => b.time === '13:00')).toBe(true);
  });

  it('the bookings route needs the cookie', async () => {
    expect((await req('my/bookings')).status).toBe(401);
    const res = await req('my/bookings', { cookie: `t_client=${clientCookie('+38349123456')}` });
    expect(res.status).toBe(200);
  });

  it('the code flow: wrong code is refused, right code sets the cookie (dev codes)', async () => {
    const phone = uniq();
    vi.stubEnv('OTP_PROVIDER', 'dev');
    const sent = await (await req('my/code', { body: { phone } })).json();
    expect(sent.dev_code).toMatch(/^\d{6}$/);
    expect((await req('my/verify', { body: { phone, code: '000000' === sent.dev_code ? '111111' : '000000' } })).status).toBe(422);
    const sent2 = await (await req('my/code', { body: { phone } })).json();
    const ok = await req('my/verify', { body: { phone, code: sent2.dev_code } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toContain('t_client=');
    vi.unstubAllEnvs();
  });

  it('verifyCode (owner login) still works after the split into consumeCode', async () => {
    const phone = uniq();
    vi.stubEnv('OTP_PROVIDER', 'dev');
    const r = await requestCode(phone);
    expect(r.devCode).toMatch(/^\d{6}$/);
    const { user } = await verifyCode(phone, r.devCode, 'Test');
    expect(user.role).toBe('owner');
    vi.unstubAllEnvs();
  });
});
