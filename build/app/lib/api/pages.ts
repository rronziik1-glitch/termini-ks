// Faqja Gati API (§8.4) and admin API (§8.5).
import { bookingUrl, livePageUrl } from '../config';
import { AppError, db } from '../db';
import { saveUpload } from '../fg/images';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_UNLOCK_HOURS, unlockAdmin } from '../adminAuth';
import { SESSION_COOKIE } from '../auth';
import { cookieValue, route } from '../http';
import {
  addAsset, checkout, createPage, deletePage, getPage, getStatus, markPaid, previewImageUrl, reorderAssets, saveContent, setPublished, startGeneration,
} from '../pages';
import { paysera } from '../payments';
import { displayPhone } from '../phone';
import { sq } from '../sq';
import { addDays, localMinToUtc, mondayOf, toLocal } from '../time';

async function fileFrom(req: Request): Promise<Buffer> {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > 15e6) throw new AppError('photo_type', 415, sq.errors.photo_type);
  return Buffer.from(await file.arrayBuffer());
}

route('POST', '/pages', 'public', async (c) => {
  const body = await c.body<Record<string, string>>();
  const page = await createPage({
    template: body.template, name: body.name, city: body.city, text: body.text, oldUrl: body.old_url, contactPhone: body.contact_phone,
    ip: c.ip, userId: c.user?.id, businessId: c.business?.id,
  });
  return { id: page.id };
});

route('POST', '/pages/:id/assets', 'public', async (c) => {
  const asset = await addAsset(c.params.id, await fileFrom(c.req));
  return { id: asset.id, url: previewImageUrl(c.params.id, asset.id) };
});

route('PUT', '/pages/:id/assets/order', 'public', async (c) => {
  const { ids } = await c.body<{ ids: string[] }>();
  await reorderAssets(c.params.id, Array.isArray(ids) ? ids : []);
  return { ok: true };
});

route('POST', '/pages/:id/generate', 'public', async (c) => {
  const body = await c.body<{ revision_note?: string; text?: string; theme_variant?: string }>().catch(() => ({} as { revision_note?: string; text?: string; theme_variant?: string }));
  const page = await startGeneration(c.params.id, { revisionNote: body.revision_note?.slice(0, 600), text: body.text, themeVariant: body.theme_variant }, c.origin);
  return { status: page.status, updatedAt: page.updatedAt.getTime(), themeVariant: page.themeVariant };
});

route('GET', '/pages/:id/status', 'public', async (c) => getStatus(c.params.id));

route('POST', '/pages/:id/checkout', 'public', async (c) => {
  const body = await c.body<{ method?: string; subdomain?: string; custom_domain?: string }>();
  return checkout(c.params.id, { method: body.method, subdomain: body.subdomain, customDomain: body.custom_domain }, c.origin);
});

async function payseraCallback(params: URLSearchParams) {
  const r = paysera.verifyCallback(params);
  if (!r.ok) throw new AppError('forbidden', 403, sq.errors.forbidden);
  if (r.paid) {
    const pending = await db.payment.findFirst({ where: { pageId: r.orderId, status: 'pending', method: 'paysera' } });
    if (pending && r.amountCents >= pending.amountCents) await markPaid(r.orderId, { method: 'paysera', providerRef: r.providerRef, note: 'Paysera callback' });
  }
  return new Response('OK', { headers: { 'content-type': 'text/plain' } });
}
route('GET', '/payments/paysera/callback', 'public', async (c) => payseraCallback(c.query));
route('POST', '/payments/paysera/callback', 'public', async (c) => payseraCallback(new URLSearchParams(await c.req.text())));

/* ---- admin -------------------------------------------------------------------------- */
// Second lock: an admin who logged in with the SMS code must also give the admin password.
route('POST', '/admin/unlock', 'user', async (c) => {
  if (c.me.role !== 'admin') throw new AppError('forbidden', 403, sq.errors.forbidden);
  const body = await c.body<{ password?: string }>();
  const r = unlockAdmin(cookieValue(c.req, SESSION_COOKIE) || '', String(body.password || '').slice(0, 200), c.ip);
  if (!r.ok) {
    const msg = r.reason === 'rate_limited' ? sq.admin.tooManyTries : r.reason === 'not_set' ? sq.admin.notSet : sq.admin.wrongPassword;
    throw new AppError(r.reason === 'rate_limited' ? 'rate_limited' : 'wrong_password', r.reason === 'rate_limited' ? 429 : 422, msg);
  }
  await db.auditLog.create({ data: { userId: c.me.id, action: 'admin.unlock', targetType: 'user', targetId: c.me.id } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, r.cookie, { httpOnly: true, sameSite: 'strict', secure: c.origin.startsWith('https://'), path: '/', maxAge: ADMIN_UNLOCK_HOURS * 3600 });
  return res;
});
route('GET', '/admin/pages', 'admin', async (c) => {
  const status = c.query.get('status') || undefined;
  const rows = await db.page.findMany({
    where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200,
    include: { payments: { orderBy: { createdAt: 'desc' } }, assets: { orderBy: { sort: 'asc' } }, generations: { orderBy: { createdAt: 'desc' }, take: 5 }, business: { select: { slug: true, name: true } } },
  });
  return {
    pages: rows.map((p) => ({
      id: p.id, name: p.inputName, city: p.inputCity, template: p.template, status: p.status, createdAt: p.createdAt.toISOString(),
      contactPhone: p.contactPhone, contactDisplay: displayPhone(p.contactPhone), text: p.inputText, oldUrl: p.inputOldUrl, notice: p.notice,
      subdomain: p.subdomain, customDomain: p.customDomain, liveUrl: p.subdomain && p.status === 'live' ? livePageUrl(p.subdomain, c.origin) : '',
      previewUrl: `${c.origin}/faqja/${p.id}`, revisionsUsed: p.revisionsUsed, content: p.contentJson,
      business: p.business ? { slug: p.business.slug, name: p.business.name } : null,
      payments: p.payments.map((x) => ({ id: x.id, method: x.method, status: x.status, amountCents: x.amountCents, reference: x.reference, paidAt: x.paidAt?.toISOString() || null })),
      assets: p.assets.map((a) => ({ id: a.id, url: previewImageUrl(p.id, a.id), kind: a.kind })),
      generations: p.generations.map((x) => ({ model: x.model, ok: x.ok, error: x.error, inputTokens: x.inputTokens, outputTokens: x.outputTokens, durationMs: x.durationMs, note: x.revisionNote })),
    })),
  };
});

route('POST', '/admin/pages/:id/mark-paid', 'admin', async (c) => {
  const body = await c.body<{ method?: string; note?: string }>();
  const page = await markPaid(c.params.id, { method: body.method, note: (body.note || '').slice(0, 200), adminUserId: c.me.id });
  return { status: page.status, liveUrl: livePageUrl(page.subdomain!, c.origin) };
});

route('POST', '/admin/pages/:id/unpublish', 'admin', async (c) => ({ status: (await setPublished(c.params.id, false, c.me.id)).status }));
route('POST', '/admin/pages/:id/publish', 'admin', async (c) => ({ status: (await setPublished(c.params.id, true, c.me.id)).status }));

route('PUT', '/admin/pages/:id/content', 'admin', async (c) => {
  const body = await c.body<{ content: unknown }>();
  await saveContent(c.params.id, body.content, c.me.id);
  return { ok: true };
});

route('POST', '/admin/pages/:id/assets/:assetId/replace', 'admin', async (c) => {
  const page = await getPage(c.params.id);
  const asset = await db.pageAsset.findFirst({ where: { id: c.params.assetId, pageId: page.id } });
  if (!asset) throw new AppError('not_found', 404, sq.errors.not_found);
  const saved = await saveUpload(page.id, await fileFrom(c.req));
  await db.pageAsset.update({ where: { id: asset.id }, data: { ...saved, kind: 'enhanced' } });
  await db.page.update({ where: { id: page.id }, data: { updatedAt: new Date() } });
  await db.auditLog.create({ data: { userId: c.me.id, action: 'page.replace_photo', targetType: 'page', targetId: page.id, metaJson: JSON.stringify({ assetId: asset.id }) } });
  return { ok: true };
});

route('DELETE', '/admin/pages/:id', 'admin', async (c) => { await deletePage(c.params.id, c.me.id); return { ok: true }; });

route('GET', '/admin/businesses', 'admin', async (c) => {
  const list = await db.business.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { owner: { select: { phone: true, name: true } }, _count: { select: { bookings: true, customers: true } } } });
  const out = [];
  for (const b of list) {
    const monday = mondayOf(toLocal(new Date(), b.timezone).date);
    const week = await db.booking.count({ where: { businessId: b.id, startsAt: { gte: localMinToUtc(monday, 0, b.timezone), lt: localMinToUtc(addDays(monday, 7), 0, b.timezone) }, status: { in: ['confirmed', 'completed'] } } });
    out.push({ id: b.id, slug: b.slug, name: b.name, category: b.category, city: b.city, url: bookingUrl(b.slug, c.origin), owner: b.owner.name, ownerPhone: displayPhone(b.owner.phone), bookingsWeek: week, bookingsTotal: b._count.bookings, customers: b._count.customers, paused: b.bookingsPaused, createdAt: b.createdAt.toISOString() });
  }
  return { businesses: out };
});
