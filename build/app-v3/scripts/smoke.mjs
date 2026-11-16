// End-to-end smoke test against a running server (no test framework, just fetch):
//   node scripts/smoke.mjs [baseUrl]     default http://localhost:3000
// Covers: public pages, Faqja Gati create → upload → generate → preview → checkout → admin mark paid → live,
// the payment gate (/p/<sub> is 404 before payment), and the owner settings API.
import sharp from 'sharp';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failures++; };

async function req(path, { method, body, cookie, form } = {}) {
  method ??= body !== undefined || form ? 'POST' : 'GET';
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: 'manual' });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, text, json, setCookie: res.headers.get('set-cookie') || '' };
}

async function login(phone) {
  const code = await req('/api/auth/code', { body: { phone } });
  const v = await req('/api/auth/verify', { body: { phone, code: code.json?.dev_code } });
  const m = /t_session=([^;]+)/.exec(v.setCookie);
  return m ? `t_session=${m[1]}` : '';
}

console.log(`Smoke test against ${BASE}`);

console.log('Public pages');
for (const p of ['/', '/faqja', '/faqja/krijo', '/gjej', '/fillo', '/hyr', '/b/berberi-arti', '/b/klinika-dardania', '/b/bujtina-rugova', '/faqja/shembull/berber', '/manifest.webmanifest']) {
  const r = await req(p);
  ok(r.status === 200, `${p} → ${r.status}`);
}
const live = await req('/p/berberi-arti');
ok(live.status === 200 && !live.text.includes('data-fg-preview'), '/p/berberi-arti is live without watermark');
ok(live.text.includes('/b/berberi-arti'), 'live page "Rezervo termin" links to Termini');
ok((await req('/p/nuk-ekziston')).status === 404, '/p/<unknown> → 404');

console.log('Faqja Gati flow');
const created = await req('/api/pages', { body: { template: 'berber', name: 'Berberi Smoke Test', city: 'Pejë', text: 'Berber në Pejë, në qendër. Qethje 5 €, mjekër 3 €. Hapur 9–20 çdo ditë. 049 555 666.', contact_phone: '049 555 666' } });
const id = created.json?.id;
ok(!!id, `page created (${id})`);
if (id) {
  const img = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 40, g: 60, b: 90 } } }).jpeg().toBuffer();
  const form = new FormData();
  form.append('file', new Blob([img], { type: 'image/jpeg' }), 'foto.jpg');
  const up = await req(`/api/pages/${id}/assets`, { method: 'POST', form });
  ok(up.status === 200 && !!up.json?.url, 'photo uploaded');
  ok((await req(up.json?.url || '/x')).status === 200, 'watermarked preview photo served');
  await req(`/api/pages/${id}/generate`, { body: {} });
  let status = 'generating';
  for (let i = 0; i < 60 && status === 'generating'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    status = (await req(`/api/pages/${id}/status`)).json?.status;
  }
  ok(status === 'preview', `generation finished: ${status}`);
  const pv = await req(`/faqja/${id}/parapamja`);
  ok(pv.status === 200 && pv.text.includes('data-fg-preview'), 'preview HTML is watermarked');
  ok(!pv.text.includes('555 666'), 'preview hides the phone number');
  ok((await req(`/faqja/${id}`)).status === 200, '/faqja/<id> screen renders');
  const style = await req(`/api/pages/${id}/generate`, { body: { theme_variant: 'a' } });
  ok(style.json?.themeVariant === 'a', '"Provo stil tjetër" switches the colour variant');
  const co = await req(`/api/pages/${id}/checkout`, { body: { method: 'bank' } });
  ok(co.status === 200 && co.json?.reference?.startsWith('FG-'), `checkout (bank) → ${co.json?.reference}`);
  const sub = co.json?.subdomain;
  ok((await req(`/p/${sub}`)).status === 404, 'not live before payment (payment gate)');
  ok((await req(`/p/${sub}?preview=0&paid=1`)).status === 404, 'query parameters cannot unlock the page');

  const admin = await login('049000000');
  ok(!!admin, 'admin login with dev code');
  const list = await req('/api/admin/pages', { cookie: admin });
  ok(list.json?.pages?.some((p) => p.id === id), 'admin sees the page');
  ok((await req('/admin', { cookie: admin })).status === 200, '/admin renders');
  ok((await req('/api/admin/pages')).status === 401, 'admin API needs a session');
  const paid = await req(`/api/admin/pages/${id}/mark-paid`, { body: { method: 'bank', note: 'smoke' }, cookie: admin });
  ok(paid.json?.status === 'live', 'admin marks paid → live');
  const lp = await req(`/p/${sub}`);
  ok(lp.status === 200 && !lp.text.includes('data-fg-preview') && lp.text.includes('555'), 'live page has no watermark and shows the phone');
  const biz = await req('/api/admin/businesses', { cookie: admin });
  ok((biz.json?.businesses?.length || 0) >= 3, 'admin business overview');
  await req(`/api/admin/pages/${id}`, { method: 'DELETE', cookie: admin });
}

console.log('Owner settings');
const owner = await login('049111111');
ok(!!owner, 'owner login (Berberi Arti)');
for (const p of ['/app', '/app/klientet', '/app/sherbimet', '/app/cilesimet', '/app/cilesimet/orari', '/app/cilesimet/rezervimet', '/app/cilesimet/profili']) {
  ok((await req(p, { cookie: owner })).status === 200, `${p} → 200`);
}
const hours = await req('/api/hours', { cookie: owner });
ok(Array.isArray(hours.json?.days) && hours.json.days.length === 7, 'GET /api/hours');
const put = await req('/api/hours', { method: 'PUT', body: hours.json, cookie: owner });
ok(put.status === 200, 'PUT /api/hours (same week back)');
const day = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
const off = await req('/api/time-off', { body: { from: day, to: day, reason: 'smoke' }, cookie: owner });
const added = off.json?.daysOff?.find((d) => d.from === day);
ok(!!added, 'day off added');
if (added) ok((await req(`/api/time-off/${added.id}`, { method: 'DELETE', cookie: owner })).status === 200, 'day off removed');
ok((await req('/api/business', { method: 'PATCH', body: { maxAdvanceDays: 30 }, cookie: owner })).status === 200, 'booking rule saved');
ok((await req('/app/cilesimet')).status !== 200, 'settings need a login (redirect)');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
