// JOB B: the online-ready setup. Nothing here talks to a real service: requests are built and inspected,
// fetch is mocked, and the PostgreSQL migration runs on PGlite (PostgreSQL compiled to WebAssembly).
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestCode } from '../lib/auth';
import { livePageUrl, pagesHostSuffix } from '../lib/config';
import { AppError, db } from '../lib/db';
import { checkEnv } from '../lib/env-check';
import { buildOtpRequest } from '../lib/otp';
import { paysera } from '../lib/payments';
import { SITE_COOKIE, classifyHost, siteToken } from '../lib/site-lock';
import { getFile, putFile, removeFiles, signS3, storageDriverId } from '../lib/storage';
import { middleware } from '../middleware';
import { postgresSchemaText } from '../scripts/lib.mjs';

const setEnv = (vars: Record<string, string>) => { for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v); };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const READY = {
  NODE_ENV: 'production', VERCEL: '1',
  APP_SECRET: 'a'.repeat(48), APP_URL: 'https://termini.app', DATABASE_URL: 'postgresql://u:p@db.example/neondb',
  ADMIN_PHONES: '+38349000000', ADMIN_PASSWORD_HASH: 'scrypt$aa$bb',
  OTP_PROVIDER: 'sms', SMS_STYLE: 'twilio', SMS_ACCOUNT_ID: 'ACxxx', SMS_API_KEY: 'token', SMS_FROM: 'Termini',
  STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x',
  PAYSERA_PROJECT_ID: '123', PAYSERA_SIGN_PASSWORD: 'pw', PAYSERA_PUBLIC_KEY: 'PEM', PAYSERA_TEST: '0',
  BANK_IBAN: 'XK05 1212 0123 4567 8906', ANTHROPIC_API_KEY: 'sk-test',
};

describe('startup env check', () => {
  it('accepts a complete production setup', () => {
    expect(checkEnv(READY)).toEqual({ errors: [], warnings: [] });
  });
  it('names every missing or placeholder value', () => {
    const r = checkEnv({ NODE_ENV: 'production', VERCEL: '1', APP_SECRET: 'dev-secret-change-me', APP_URL: 'http://localhost:3000', DATABASE_URL: 'file:./dev.db' });
    const text = r.errors.join('\n');
    for (const key of ['APP_SECRET', 'APP_URL', 'DATABASE_URL', 'OTP_PROVIDER', 'STORAGE_DRIVER']) expect(text).toContain(key);
  });
  it('wants the keys of the chosen providers', () => {
    expect(checkEnv({ ...READY, SMS_API_KEY: '' }).errors.join()).toContain('SMS_API_KEY');
    expect(checkEnv({ ...READY, OTP_PROVIDER: 'whatsapp' }).errors.join()).toContain('WHATSAPP_API_TOKEN');
    expect(checkEnv({ ...READY, STORAGE_DRIVER: 's3' }).errors.join()).toContain('S3_BUCKET');
    expect(checkEnv({ ...READY, PAYSERA_PUBLIC_KEY: '' }).errors.join()).toContain('PAYSERA_PUBLIC_KEY');
    expect(checkEnv({ ...READY, SMS_STYLE: 'generic', SMS_API_URL: 'https://sms.example/send', SMS_API_HEADERS: '{bad' }).errors.join()).toContain('SMS_API_HEADERS');
  });
  it('warns, but does not stop, for test payments and the launch password', () => {
    const r = checkEnv({ ...READY, PAYSERA_TEST: '1', SITE_PASSWORD: 'hapu' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toContain('PAYSERA_TEST');
    expect(r.warnings.join()).toContain('SITE_PASSWORD');
  });
  it('allows SQLite and local photos on your own computer, not on Vercel', () => {
    const local = { ...READY, VERCEL: '', DATABASE_URL: 'file:./dev.db', STORAGE_DRIVER: 'local' };
    expect(checkEnv(local).errors).toEqual([]);
    expect(checkEnv({ ...local, VERCEL: '1' }).errors).toHaveLength(2);
  });
});

describe('login code providers', () => {
  it('Twilio: form body with basic auth', () => {
    setEnv({ SMS_STYLE: 'twilio', SMS_ACCOUNT_ID: 'AC123', SMS_API_KEY: 'secret', SMS_FROM: 'Termini' });
    const r = buildOtpRequest('sms', '+38349123456', '123456');
    expect(r.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(r.headers.authorization).toBe('Basic ' + Buffer.from('AC123:secret').toString('base64'));
    const body = new URLSearchParams(r.body);
    expect(body.get('To')).toBe('+38349123456');
    expect(body.get('Body')).toContain('123456');
  });
  it('Infobip: JSON with the App key', () => {
    setEnv({ SMS_STYLE: 'infobip', SMS_API_URL: 'https://abc.api.infobip.com/', SMS_API_KEY: 'k', SMS_FROM: 'Termini' });
    const r = buildOtpRequest('sms', '+38349123456', '654321');
    expect(r.url).toBe('https://abc.api.infobip.com/sms/2/text/advanced');
    expect(r.headers.authorization).toBe('App k');
    expect(JSON.parse(r.body).messages[0]).toMatchObject({ from: 'Termini', destinations: [{ to: '38349123456' }] });
  });
  it('generic gateway: URL, headers and body come from the env templates', () => {
    setEnv({ SMS_STYLE: 'generic', SMS_API_URL: 'https://sms.example/send', SMS_API_KEY: 'K1', SMS_API_HEADERS: '{"Authorization":"Bearer {key}"}', SMS_API_BODY: '{"msisdn":"{to}","message":"{text}"}', OTP_TEXT: 'Kodi "{code}"' });
    const r = buildOtpRequest('sms', '+38349123456', '111222');
    expect(r.headers.Authorization).toBe('Bearer K1');
    expect(JSON.parse(r.body)).toEqual({ msisdn: '38349123456', message: 'Kodi "111222"' });   // quotes stay valid JSON
  });
  it('WhatsApp Cloud API: authentication template with the code twice', () => {
    setEnv({ WHATSAPP_API_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: '999', WHATSAPP_OTP_TEMPLATE: 'login_code' });
    const r = buildOtpRequest('whatsapp', '+38349123456', '424242');
    expect(r.url).toBe('https://graph.facebook.com/v21.0/999/messages');
    const body = JSON.parse(r.body);
    expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '38349123456', type: 'template' });
    expect(body.template.components.map((c: { parameters: { text: string }[] }) => c.parameters[0].text)).toEqual(['424242', '424242']);
  });
  it('with a real provider the code is sent and never returned to the browser', async () => {
    setEnv({ OTP_PROVIDER: 'sms', SMS_STYLE: 'generic', SMS_API_URL: 'https://sms.example/send' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const r = await requestCode('049 700 701', '10.9.9.1');
    expect(r.devCode).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://sms.example/send');
    expect(await db.loginCode.count({ where: { phone: '+38349700701' } })).toBe(1);
  });
  it('when the provider refuses, the user gets an Albanian error and no code is left behind', async () => {
    setEnv({ OTP_PROVIDER: 'sms', SMS_STYLE: 'generic', SMS_API_URL: 'https://sms.example/send' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no credit', { status: 402 }));
    await expect(requestCode('049 700 702', '10.9.9.2')).rejects.toMatchObject({ code: 'code_not_sent' } satisfies Partial<AppError>);
    expect(await db.loginCode.count({ where: { phone: '+38349700702' } })).toBe(0);
  });
});

describe('photo storage', () => {
  it('local driver: save, read, delete a folder', async () => {
    expect(storageDriverId()).toBe('local');
    await putFile('test-job-b/a/one.jpg', Buffer.from('abc'));
    expect((await getFile('test-job-b/a/one.jpg'))?.toString()).toBe('abc');
    await removeFiles('test-job-b');
    expect(await getFile('test-job-b/a/one.jpg')).toBeNull();
  });
  it('refuses keys that climb out of the storage folder', async () => {
    await expect(putFile('../outside.jpg', Buffer.from('x'))).rejects.toThrow();
    expect(await getFile('pages/../../.env')).toBeNull();
  });
  it('S3 signature matches the worked example in the AWS documentation', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html (GET Object)
    const r = signS3(
      { endpoint: 'https://examplebucket.s3.amazonaws.com', region: 'us-east-1', bucket: 'examplebucket', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      'GET', '/test.txt', {}, '', { range: 'bytes=0-9' }, new Date('2013-05-24T00:00:00Z'),
    );
    expect(r.signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  });
});

describe('Paysera settings come from the environment', () => {
  it('builds the checkout link from the env values', () => {
    setEnv({ PAYSERA_PROJECT_ID: '4242', PAYSERA_SIGN_PASSWORD: 'pw', PAYSERA_TEST: '1', PAYSERA_LANG: 'LIT', PAYSERA_PAY_URL: 'https://sandbox.example/pay/' });
    expect(paysera.configured()).toBe(true);
    const { redirectUrl } = paysera.createCheckout({ orderId: 'p1', amountCents: 10000, description: 'Faqja Gati', acceptUrl: 'https://a/ok', cancelUrl: 'https://a/no', callbackUrl: 'https://a/api/payments/paysera/callback' });
    expect(redirectUrl.startsWith('https://sandbox.example/pay/?data=')).toBe(true);
    const data = new URL(redirectUrl).searchParams.get('data')!;
    const q = new URLSearchParams(Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    expect(Object.fromEntries(q)).toMatchObject({ projectid: '4242', amount: '10000', currency: 'EUR', test: '1', lang: 'LIT' });
  });
});

describe('addresses: subdomains and customer domains', () => {
  it('reads the host', () => {
    setEnv({ APP_URL: 'https://termini.app', PAGES_DOMAIN: 'faqjagati.com' });
    expect(classifyHost('termini.app')).toEqual({ kind: 'app' });
    expect(classifyHost('berberi-arti.faqjagati.com')).toEqual({ kind: 'page', slug: 'berberi-arti' });
    expect(classifyHost('www.faqjagati.com')).toEqual({ kind: 'www' });
    expect(classifyHost('faqjagati.com')).toEqual({ kind: 'www' });
    expect(classifyHost('www.termini.app')).toEqual({ kind: 'www' });
    expect(classifyHost('berberiarti.com')).toEqual({ kind: 'page', slug: 'berberiarti.com' });
    expect(classifyHost('termini-abc123.vercel.app')).toEqual({ kind: 'app' });
    expect(classifyHost('localhost:3000')).toEqual({ kind: 'app' });
  });
  it('without PAGES_DOMAIN the subdomains of the app domain are pages', () => {
    setEnv({ APP_URL: 'https://termini.app', PAGES_DOMAIN: '' });
    expect(classifyHost('berberi-arti.termini.app')).toEqual({ kind: 'page', slug: 'berberi-arti' });
    expect(livePageUrl('berberi-arti')).toBe('https://termini.app/p/berberi-arti');
    expect(pagesHostSuffix()).toBe('.faqjagati.com');
  });
  it('page links use the pages domain when it is set', () => {
    setEnv({ APP_URL: 'https://termini.app', PAGES_DOMAIN: 'faqjagati.com' });
    expect(livePageUrl('berberi-arti')).toBe('https://berberi-arti.faqjagati.com');
    expect(pagesHostSuffix()).toBe('.faqjagati.com');
  });
  it('middleware shows the page on its subdomain and keeps the app off it', async () => {
    setEnv({ APP_URL: 'https://termini.app', PAGES_DOMAIN: 'faqjagati.com', SITE_PASSWORD: '' });
    const req = (url: string, host: string) => new NextRequest(url, { headers: { host } });
    const home = await middleware(req('https://berberi-arti.faqjagati.com/', 'berberi-arti.faqjagati.com'));
    expect(home.headers.get('x-middleware-rewrite')).toContain('/p/berberi-arti');
    const photo = await middleware(req('https://berberi-arti.faqjagati.com/p/berberi-arti/img/abc', 'berberi-arti.faqjagati.com'));
    expect(photo.headers.get('x-middleware-next')).toBe('1');
    const admin = await middleware(req('https://berberi-arti.faqjagati.com/admin', 'berberi-arti.faqjagati.com'));
    expect(admin.status).toBe(307);
    expect(admin.headers.get('location')).toBe('https://termini.app/admin');
    const main = await middleware(req('https://termini.app/faqja', 'termini.app'));
    expect(main.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('private launch password', () => {
  const req = (pathname: string, cookie = '') => new NextRequest('https://termini.app' + pathname, { headers: { host: 'termini.app', ...(cookie ? { cookie } : {}) } });
  it('asks for the password on pages and answers 401 on the API', async () => {
    setEnv({ APP_URL: 'https://termini.app', SITE_PASSWORD: 'hapu-2026' });
    const page = await middleware(req('/faqja?x=1'));
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toBe('https://termini.app/site-password?next=%2Ffaqja%3Fx%3D1');
    expect((await middleware(req('/api/businesses'))).status).toBe(401);
    expect((await middleware(req('/p/berberi-arti'))).status).toBe(307);
  });
  it('lets the Paysera callback and the password form through', async () => {
    setEnv({ APP_URL: 'https://termini.app', SITE_PASSWORD: 'hapu-2026' });
    expect((await middleware(req('/api/payments/paysera/callback?data=x'))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(req('/site-password'))).headers.get('x-middleware-next')).toBe('1');
  });
  it('opens with the right cookie only', async () => {
    setEnv({ APP_URL: 'https://termini.app', SITE_PASSWORD: 'hapu-2026' });
    expect((await middleware(req('/faqja', `${SITE_COOKIE}=${await siteToken()}`))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(req('/faqja', `${SITE_COOKIE}=${await siteToken('wrong')}`))).status).toBe(307);
  });
  it('is off when SITE_PASSWORD is empty', async () => {
    setEnv({ APP_URL: 'https://termini.app', SITE_PASSWORD: '' });
    expect((await middleware(req('/faqja'))).headers.get('x-middleware-next')).toBe('1');
  });
});

describe('PostgreSQL', () => {
  const pgSchema = path.join('prisma', 'postgres', 'schema.prisma');
  const migrations = path.join('prisma', 'postgres', 'migrations');
  const sql = () => fs.readdirSync(migrations).filter((d) => fs.statSync(path.join(migrations, d)).isDirectory()).sort()
    .map((d) => fs.readFileSync(path.join(migrations, d, 'migration.sql'), 'utf8')).join('\n');

  it('prisma/postgres/schema.prisma is in sync with prisma/schema.prisma', () => {
    expect(fs.readFileSync(pgSchema, 'utf8').replace(/\r\n/g, '\n')).toBe(postgresSchemaText());
  });
  it('the migrations create every model and column of the schema', () => {
    const schema = fs.readFileSync(path.join('prisma', 'schema.prisma'), 'utf8');
    const all = sql();
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
    expect(models.length).toBeGreaterThan(10);
    for (const [, name, body] of models) {
      expect(all, name).toContain(`CREATE TABLE "${name}"`);
      for (const line of body.split('\n')) {
        const m = /^\s+(\w+)\s+(String|Int|Float|Boolean|DateTime)\??(\s|$)/.exec(line);
        if (m) expect(all, `${name}.${m[1]}`).toMatch(new RegExp(`"${name}"[\\s\\S]*?"${m[1]}"`));
      }
    }
  });
  it('the migration SQL runs on PostgreSQL and the main tables accept rows', async () => {
    const pg = new PGlite();
    await pg.exec(sql());
    await pg.exec(`INSERT INTO "User" ("id","phone","updatedAt") VALUES ('u1','+38349000001',now());`);
    await pg.exec(`INSERT INTO "CategoryPreset" ("category","servicesJson","hoursJson","updatedAt") VALUES ('lavazh','[]','[]',now());`);
    const users = await pg.query<{ role: string }>('SELECT "role" FROM "User"');
    expect(users.rows).toEqual([{ role: 'owner' }]);
    await expect(pg.exec(`INSERT INTO "User" ("id","phone","updatedAt") VALUES ('u2','+38349000001',now());`)).rejects.toThrow();   // unique phone
    const locked = await pg.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['biz:1']);                                       // the booking lock exists
    expect(locked.rows).toHaveLength(1);
    await pg.close();
  });
});
