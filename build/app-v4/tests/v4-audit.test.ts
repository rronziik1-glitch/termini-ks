// Regression tests for the v4 Fable audit (fable/04-fable-audit.md). One block per finding.
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import type { Business, Service } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fillContent, normalize } from '../lib/ai';
import { requestCode } from '../lib/auth';
import { createPublicBooking } from '../lib/booking';
import { createBusiness, defaultHours } from '../lib/business';
import { config, pagesHostPrefix, pagesHostSuffix, randomId } from '../lib/config';
import { AppError, db } from '../lib/db';
import { checkEnv } from '../lib/env-check';
import { saveUpload } from '../lib/fg/images';
import { demoContent, renderExample, renderPreview } from '../lib/fg/render';
import { htmlResponse, pageCsp } from '../lib/fg/serve';
import { dispatch, sameOriginWrite } from '../lib/http';
import { otpAllowedFor } from '../lib/otp';
import { GENERATION_STALE_MS, checkout, createPage, getStatus, runGeneration, startGeneration } from '../lib/pages';
import { paysera } from '../lib/payments';
import { rateLimitDb } from '../lib/ratelimit';
import { sq } from '../lib/sq';
import { addDays, isDate, toLocal, weekdayOf } from '../lib/time';
import '../lib/api/public';

const TEXT = 'Berber në Gjakovë, te Çarshia e Madhe. Qethje 5 €, mjekër 3 €. Hapur 9–20, të dielën mbyllur. 049 123 456.';
const saved: Record<string, string | undefined> = {};
function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in saved)) saved[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; delete saved[k]; }
  vi.restoreAllMocks();
});
afterAll(async () => { await db.$disconnect(); });

const code = async (fn: () => Promise<unknown>) => { try { await fn(); return 'ok'; } catch (e) { return e instanceof AppError ? e.code : String(e); } };
const uniquePhone = (prefix = '+38344') => prefix + String(Math.floor(100000 + Math.random() * 899999));

/* ---- H1 ------------------------------------------------------------------------------ */
describe('H1: a date must be a real calendar day', () => {
  let biz: Business;
  let cut: Service;
  beforeAll(async () => {
    const user = await db.user.create({ data: { phone: uniquePhone('+38348'), name: 'Pronari' } });
    biz = await createBusiness(user, { name: `Date Test ${randomId(5)}`, category: 'berber', city: 'Prishtinë', services: [{ name: 'Qethje', durationMin: 30, price: 5 }], hours: defaultHours('berber') });
    cut = (await db.service.findFirst({ where: { businessId: biz.id } }))!;
  });

  it('rejects days that do not exist', () => {
    for (const d of ['2026-11-31', '2026-02-30', '2027-02-29', '2026-04-31', '2026-13-01', '2026-00-10']) expect(isDate(d), d).toBe(false);
    for (const d of ['2026-11-30', '2028-02-29', '2026-12-01']) expect(isDate(d), d).toBe(true);
  });

  it('a taken slot cannot be booked again through an impossible date that means the same day', async () => {
    // Find a month end with fewer than 31 days whose "day 31" lands on an open day inside the booking window.
    const today = toLocal(new Date(), biz.timezone).date;
    await db.business.update({ where: { id: biz.id }, data: { maxAdvanceDays: 400 } });
    biz = (await db.business.findUnique({ where: { id: biz.id } }))!;
    let real = '', alias = '';
    for (let m = 1; m < 14 && !real; m++) {
      const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + m, 1));
      const ym = d.toISOString().slice(0, 7);
      const last = Number(addDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10), -1).slice(8));
      if (last === 31) continue;
      const candidate = addDays(`${ym}-${last}`, 31 - last);                 // what "…-31" turns into
      if (weekdayOf(candidate) !== 7) { real = candidate; alias = `${ym}-31`; }
    }
    expect(real).not.toBe('');
    const first = await createPublicBooking(biz, { serviceId: cut.id, date: real, time: '10:00', name: 'Klienti Parë', phone: uniquePhone(), skipRateLimit: true });
    expect(first.id).toBeTruthy();
    expect(await code(() => createPublicBooking(biz, { serviceId: cut.id, date: alias, time: '10:00', name: 'Klienti Dytë', phone: uniquePhone(), skipRateLimit: true }))).toBe('bad_request');
    expect(await db.booking.count({ where: { businessId: biz.id, status: 'confirmed' } })).toBe(1);
  });

  it('M3: more than 5 bookings an hour from one IP are refused, counted in the database', async () => {
    const day = addDays(toLocal(new Date(), biz.timezone).date, 8 - weekdayOf(toLocal(new Date(), biz.timezone).date));   // next Monday
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
    const results: string[] = [];
    for (const time of times) results.push(await code(() => createPublicBooking(biz, { serviceId: cut.id, date: day, time, name: 'Një Klient', phone: uniquePhone(), ip: '203.0.113.77' })));
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'rate_limited']);
  });
});

/* ---- H2 + H3 ---------------------------------------------------------------------------- */
describe('H2/H3: login codes', () => {
  it('the database limiter counts across calls and keeps keys apart', async () => {
    const key = `test:${randomId(8)}`;
    expect([await rateLimitDb(key, 2, 60e3), await rateLimitDb(key, 2, 60e3), await rateLimitDb(key, 2, 60e3)]).toEqual([true, true, false]);
    expect(await rateLimitDb(key + ':other', 2, 60e3)).toBe(true);
    // No raw key (phone, IP) is stored.
    expect(await db.rateHit.count({ where: { key: { contains: 'test:' } } })).toBe(0);
  });

  it('a 6th code for the same phone within 15 minutes is refused', async () => {
    const phone = uniquePhone();
    const out: string[] = [];
    for (let i = 0; i < 6; i++) out.push(await code(() => requestCode(phone, `198.51.100.${i}`)));
    expect(out).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'rate_limited']);
  });

  it('with a real provider, codes go only to the allowed countries', async () => {
    expect(otpAllowedFor('+38349123456')).toBe(true);
    expect(otpAllowedFor('+355691234567')).toBe(true);
    expect(otpAllowedFor('+447700900123')).toBe(false);
    setEnv({ OTP_ALLOWED_PREFIXES: '+383, 41' });
    expect(otpAllowedFor('+41791234567')).toBe(true);
    expect(otpAllowedFor('+355691234567')).toBe(false);
    setEnv({ OTP_ALLOWED_PREFIXES: '*' });
    expect(otpAllowedFor('+447700900123')).toBe(true);

    setEnv({ OTP_ALLOWED_PREFIXES: undefined, OTP_PROVIDER: 'sms', SMS_API_URL: 'https://sms.example/send' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await code(() => requestCode('+447700900123', '198.51.100.200'))).toBe('phone_country');
    expect(fetchMock).not.toHaveBeenCalled();                       // nothing was sent, nothing was paid
    expect(sq.errors.phone_country).toContain('Kosovës');
  });
});

/* ---- H4 + H5 ------------------------------------------------------------------------------ */
describe('H4/H5: demo settings are refused on a public site', () => {
  const READY = {
    NODE_ENV: 'production', APP_SECRET: 'x'.repeat(40), APP_URL: 'https://terminiks.com', DATABASE_URL: 'postgresql://u:p@h/db',
    ADMIN_PHONES: '+38349000001', ADMIN_PASSWORD_HASH: 'scrypt$a$b', OTP_PROVIDER: 'sms', SMS_API_URL: 'https://sms.example/send',
    STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 't', BANK_IBAN: 'XK05 1212 0123 4567 8906',
    PAYSERA_PROJECT_ID: '1', PAYSERA_SIGN_PASSWORD: 'pw', PAYSERA_PUBLIC_KEY: 'PEM', PAYSERA_TEST: '0',
  };

  it('codes on screen without the launch password stop the start', () => {
    const open = checkEnv({ ...READY, OTP_PROVIDER: 'dev', DEMO_SHOW_CODES_IN_PRODUCTION: '1' });
    expect(open.errors.join('\n')).toContain('DEMO_SHOW_CODES_IN_PRODUCTION');
    const locked = checkEnv({ ...READY, OTP_PROVIDER: 'dev', DEMO_SHOW_CODES_IN_PRODUCTION: '1', SITE_PASSWORD: 'hapu' });
    expect(locked.errors).toEqual([]);
    expect(locked.warnings.join('\n')).toContain('LOGIN CODES ARE SHOWN');
  });

  it('the app itself hides codes in production unless the site is private', () => {
    setEnv({ NODE_ENV: 'production', DEMO_SHOW_CODES_IN_PRODUCTION: '1', SITE_PASSWORD: '' });
    expect(config.showLoginCodes()).toBe(false);
    setEnv({ SITE_PASSWORD: 'hapu' });
    expect(config.showLoginCodes()).toBe(true);
  });

  it('Paysera test mode on a public site stops the start', () => {
    expect(checkEnv({ ...READY, PAYSERA_TEST: '1' }).errors.join('\n')).toContain('PAYSERA_TEST');
    expect(checkEnv({ ...READY, PAYSERA_TEST: '1', SITE_PASSWORD: 'hapu' }).errors).toEqual([]);
    expect(checkEnv(READY).errors).toEqual([]);
  });
});

describe('H5/M1: Paysera callback', () => {
  const md5 = (s: string) => createHash('md5').update(s).digest('hex');
  const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const keys = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const pem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  function callback(fields: Record<string, string>) {
    const data = b64url(new URLSearchParams({ projectid: '4242', orderid: 'page1', amount: '10000', currency: 'EUR', status: '1', requestid: 'r1', ...fields }).toString());
    const ss2 = createSign('RSA-SHA1').update(data).sign(keys.privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_');
    return new URLSearchParams({ data, ss1: md5(data + 'pw'), ss2 });
  }
  const live = { PAYSERA_PROJECT_ID: '4242', PAYSERA_SIGN_PASSWORD: 'pw', PAYSERA_PUBLIC_KEY: pem };

  it('counts what was really paid, in euros', () => {
    setEnv({ ...live, PAYSERA_TEST: '0' });
    expect(paysera.verifyCallback(callback({}))).toMatchObject({ ok: true, paid: true, amountCents: 10000 });
    expect(paysera.verifyCallback(callback({ payamount: '100', paycurrency: 'EUR' }))).toMatchObject({ ok: true, amountCents: 100 });
    expect(paysera.verifyCallback(callback({ payamount: '10000', paycurrency: 'USD' })).ok).toBe(false);
    const tampered = callback({});
    tampered.set('ss1', 'a'.repeat(32));
    expect(paysera.verifyCallback(tampered).ok).toBe(false);
  });

  it('in production a test payment counts only while the site is private and in test mode', () => {
    setEnv({ ...live, NODE_ENV: 'production', PAYSERA_TEST: '1', SITE_PASSWORD: '' });
    expect(paysera.verifyCallback(callback({ test: '1' })).ok).toBe(false);          // public site: never
    setEnv({ SITE_PASSWORD: 'hapu' });
    expect(paysera.verifyCallback(callback({ test: '1' })).ok).toBe(true);           // private test: yes
    setEnv({ PAYSERA_TEST: '0' });
    expect(paysera.verifyCallback(callback({ test: '1' })).ok).toBe(false);          // live mode: never
    expect(paysera.verifyCallback(callback({})).ok).toBe(true);                      // a real payment
  });
});

/* ---- H6 + M2 + M5 ---------------------------------------------------------------------------- */
describe('H6/M2/M5: pages', () => {
  let pageId = '';
  beforeAll(async () => {
    const page = await createPage({ template: 'berber', name: 'Berberi Test', city: 'Gjakovë', text: TEXT, contactPhone: uniquePhone(), ip: `10.9.${Math.floor(Math.random() * 250)}.1` });
    pageId = page.id;
    await runGeneration(pageId);
  });

  it('a generation that was cut off becomes "failed" so the owner can retry', async () => {
    const stuck = await createPage({ template: 'berber', name: 'I Ngecur', city: 'Pejë', text: TEXT, contactPhone: uniquePhone(), ip: `10.8.${Math.floor(Math.random() * 250)}.1` });
    await db.page.update({ where: { id: stuck.id }, data: { status: 'generating', stage: 'write', updatedAt: new Date(Date.now() - GENERATION_STALE_MS - 5000) } });
    expect((await getStatus(stuck.id)).status).toBe('failed');
    const fresh = await createPage({ template: 'berber', name: 'I Ri', city: 'Pejë', text: TEXT, contactPhone: uniquePhone(), ip: `10.7.${Math.floor(Math.random() * 250)}.1` });
    await db.page.update({ where: { id: fresh.id }, data: { status: 'generating', stage: 'write' } });
    expect((await getStatus(fresh.id)).status).toBe('generating');            // still inside the time limit
  });

  it('a paid page cannot be sent back to "generating"', async () => {
    const paid = await createPage({ template: 'berber', name: 'E Paguar', city: 'Pejë', text: TEXT, contactPhone: uniquePhone(), ip: `10.6.${Math.floor(Math.random() * 250)}.1` });
    await runGeneration(paid.id);
    await db.page.update({ where: { id: paid.id }, data: { status: 'live' } });
    expect(await code(() => startGeneration(paid.id, { revisionNote: 'ndrysho' }))).toBe('forbidden');
    expect((await db.page.findUnique({ where: { id: paid.id } }))!.status).toBe('live');
  });

  it('the automatic retry never calls the AI, and the model cannot set a hero video', async () => {
    setEnv({ ANTHROPIC_API_KEY: 'sk-test' });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const input = { template: 'berber' as const, name: 'Berberi Test', city: 'Gjakovë', text: TEXT, photoCount: 0, contactPhone: '+38349123456' };
    const r = await fillContent(input, { noAi: true });
    expect(r.model).toBe('local-filler');
    expect(fetchMock).not.toHaveBeenCalled();
    const fromModel = JSON.parse(JSON.stringify(r.content));
    fromModel.hero.video = { src: 'https://evil.example/v.mp4', poster: '' };
    expect(normalize(fromModel, input).hero.video).toBeUndefined();
  });

  it('a custom domain must look like a domain and cannot be one of our addresses', async () => {
    setEnv({ APP_URL: 'https://terminiks.com' });
    for (const bad of ['jo domen', 'terminiks.com', 'x.terminiks.com', 'a', 'projekti.vercel.app', '-keq-.com']) {
      expect(await code(() => checkout(pageId, { method: 'bank', customDomain: bad }, 'https://terminiks.com')), bad).toBe('bad_domain');
    }
    const ok = await checkout(pageId, { method: 'bank', customDomain: 'https://www.BerberiArti.com/' }, 'https://terminiks.com');
    expect(ok.amountCents).toBe(11500);
    expect((await db.page.findUnique({ where: { id: pageId } }))!.customDomain).toBe('berberiarti.com');
  });

  it('the address shown on the payment screen is a real one', () => {
    setEnv({ APP_URL: 'https://terminiks.com', PAGES_DOMAIN: '' });
    expect(pagesHostPrefix() + 'berberi-arti' + pagesHostSuffix()).toBe('terminiks.com/p/berberi-arti');
    setEnv({ PAGES_DOMAIN: 'terminiks.com' });
    expect(pagesHostPrefix() + 'berberi-arti' + pagesHostSuffix()).toBe('berberi-arti.terminiks.com');
  });
});

/* ---- H7 ------------------------------------------------------------------------------------------ */
describe('H7: writes are accepted only from our own origin', () => {
  const req = (method: string, headers: Record<string, string>) => new Request('https://terminiks.com/api/business', { method, headers });

  it('same origin and non-browser clients pass; other sites and customer pages do not', () => {
    setEnv({ APP_URL: 'https://terminiks.com', PAGES_DOMAIN: 'terminiks.com' });
    expect(sameOriginWrite(req('POST', { host: 'terminiks.com', origin: 'https://terminiks.com' }))).toBe(true);
    expect(sameOriginWrite(req('POST', { host: 'terminiks.com' }))).toBe(true);                                       // Paysera's server, scripts
    expect(sameOriginWrite(req('GET', { host: 'terminiks.com', origin: 'https://evil.example' }))).toBe(true);        // reads change nothing
    expect(sameOriginWrite(req('POST', { host: 'terminiks.com', origin: 'https://evil.example' }))).toBe(false);
    expect(sameOriginWrite(req('DELETE', { host: 'terminiks.com', origin: 'https://berberi-arti.terminiks.com' }))).toBe(false);   // a customer page
    expect(sameOriginWrite(req('POST', { host: 'berberi-arti.terminiks.com', origin: 'https://berberi-arti.terminiks.com' }))).toBe(false);
    expect(sameOriginWrite(req('POST', { host: 'terminiks.com', origin: 'null' }))).toBe(false);
    expect(sameOriginWrite(req('PATCH', { host: 'termini-abc.vercel.app', origin: 'https://termini-abc.vercel.app' }))).toBe(true);   // Vercel preview address
  });

  it('the API answers 403 to a cross-site write and 404 to a broken address', async () => {
    setEnv({ APP_URL: 'https://terminiks.com' });
    const cross = await dispatch(new Request('https://terminiks.com/api/auth/logout', { method: 'POST', headers: { host: 'terminiks.com', origin: 'https://evil.example' } }), ['auth', 'logout']);
    expect(cross.status).toBe(403);
    const own = await dispatch(new Request('https://terminiks.com/api/auth/logout', { method: 'POST', headers: { host: 'terminiks.com', origin: 'https://terminiks.com' } }), ['auth', 'logout']);
    expect(own.status).toBe(200);
    const broken = await dispatch(new Request('https://terminiks.com/api/public/bookings/x'), ['public', 'bookings', '%E0%A4%A']);
    expect(broken.status).toBe(404);
  });
});

/* ---- H8 + M4 + examples ------------------------------------------------------------------------------ */
describe('H8/M4: generated pages', () => {
  it('previews and live pages carry a Content-Security-Policy that allows only our own script', () => {
    for (const kind of ['preview', 'live'] as const) {
      const csp = htmlResponse('<html></html>', kind).headers.get('content-security-policy') || '';
      expect(csp).toBe(pageCsp(kind));
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("connect-src 'none'");
      expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    }
    expect(pageCsp('live')).toContain("frame-ancestors 'none'");
    expect(pageCsp('preview')).toContain("frame-ancestors 'self'");
  });

  it('an SVG (or anything that is not a photo) is refused as an upload', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    expect(await code(() => saveUpload('test-page', svg))).toBe('photo_type');
    expect(await code(() => saveUpload('test-page', Buffer.from('not an image at all')))).toBe('photo_type');
  });

  it('examples show the whole demo page; a customer preview hides half and never has a long unbreakable bar', () => {
    const example = renderExample(demoContent('berber'));
    expect(example).toContain('data-fg-preview');                  // still locked: watermark, no working links
    expect(example).not.toContain('█');
    expect(example).not.toMatch(/<a [^>]*href="(https?:|tel:|mailto:)/);
    const preview = renderPreview(demoContent('berber'));
    expect(preview).toContain('█');
    expect(preview).not.toMatch(/█{13,}/);
  });
});

describe('copy', () => {
  it('the login text names the channel the code really used', () => {
    expect(sq.login.codeSent('whatsapp')).toContain('WhatsApp');
    expect(sq.login.codeSent('sms')).toContain('SMS');
    expect(sq.login.codeSent('dev')).not.toMatch(/SMS|WhatsApp/);
  });
});
