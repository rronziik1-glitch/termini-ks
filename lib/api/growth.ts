// v7 API: unclaimed listings + "I want to book here", review page, the owner's "Arka" (money book, outbox, story),
// admin listings, and the daily cron that prepares the automatic messages.
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { AppError, db } from '../db';
import { route } from '../http';
import { addListingRequest, findListings, importListings, parseListingCsv } from '../listings';
import { log } from '../log';
import { markMessage, outbox, planAll, planMessages } from '../messages';
import { EXPENSE_CATS, isMonth, monthMoney, moneyCsv, thisMonth } from '../money';
import { displayPhone } from '../phone';
import { rateLimitDb } from '../ratelimit';
import { sq } from '../sq';
import { getFile, putFile, removeFiles } from '../storage';
import { isDate, toLocal } from '../time';
import { ipHash, randomId } from '../config';

const bad = () => new AppError('bad_request', 400, sq.errors.bad_request);

/* ---- public ------------------------------------------------------------------------------------------------------ */
route('GET', '/public/listings', 'public', async (c) => ({
  listings: await findListings({ city: c.query.get('city') || undefined, category: c.query.get('category') || undefined, q: c.query.get('q') || undefined }),
}));

route('POST', '/public/listings/:slug/request', 'public', async (c) => {
  const body = await c.body<Record<string, string>>();
  return addListingRequest(c.params.slug, { name: body.name, phone: body.phone, note: body.note, website: body.website }, c.ip);
});

async function bookingForReview(token: string) {
  const b = await db.booking.findUnique({ where: { token }, include: { business: true } });
  if (!b || b.business.suspendedAt) throw new AppError('not_found', 404, sq.errors.not_found);
  return b;
}

route('POST', '/public/review/:token', 'public', async (c) => {
  const b = await bookingForReview(c.params.token);
  if (!(await rateLimitDb(`review:${ipHash(c.ip)}`, 20, 3600e3))) throw new AppError('rate_limited', 429, sq.errors.rate_limited);
  const body = await c.body<{ rating?: number; comment?: string }>();
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) throw bad();
  if (b.endsAt > new Date()) throw new AppError('too_early', 409, sq.errors.bad_request);   // only after the visit
  const comment = (body.comment || '').trim().slice(0, 600);
  const old = await db.feedback.findUnique({ where: { bookingId: b.id } });
  if (old) {
    // The rating is given once; a private comment may be added afterwards.
    if (comment && !old.comment) await db.feedback.update({ where: { id: old.id }, data: { comment } });
  } else {
    await db.feedback.create({ data: { businessId: b.businessId, bookingId: b.id, rating, comment } });
  }
  // Every rating gets the Google link (asking only happy clients for public reviews is against Google's rules).
  return { ok: true, google: b.business.googleReviewUrl || '' };
});

/* ---- owner: Arka ---------------------------------------------------------------------------------------------------- */
route('GET', '/arka', 'owner', async (c) => {
  const month = isMonth(c.query.get('month')) ? c.query.get('month')! : thisMonth(c.biz);
  await planMessages(c.biz).catch((e) => log.warn('messages.plan_failed', { error: String(e) }));   // works even without the cron
  const [money, msgs, feedback] = await Promise.all([
    monthMoney(c.biz, month),
    outbox(c.biz),
    db.feedback.findMany({ where: { businessId: c.biz.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const tz = c.biz.timezone;
  return {
    month, thisMonth: thisMonth(c.biz), money, outbox: msgs,
    feedback: feedback.map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, date: toLocal(f.createdAt, tz).date })),
    settings: { autoReminders: c.biz.autoReminders, winbackOn: c.biz.winbackOn, reviewAskOn: c.biz.reviewAskOn, googleReviewUrl: c.biz.googleReviewUrl },
  };
});

route('POST', '/messages/:id/sent', 'owner', async (c) => ({ ok: await markMessage(c.biz, c.params.id, 'sent') }));
route('POST', '/messages/:id/skip', 'owner', async (c) => ({ ok: await markMessage(c.biz, c.params.id, 'skipped') }));

route('POST', '/bookings/:id/paid', 'owner', async (c) => {
  const { method } = await c.body<{ method?: string }>();
  const m = method === 'cash' || method === 'card' ? method : '';
  const r = await db.booking.updateMany({ where: { id: c.params.id, businessId: c.biz.id }, data: { paidMethod: m } });
  if (!r.count) throw new AppError('not_found', 404, sq.errors.not_found);
  return { ok: true, method: m };
});

route('POST', '/expenses', 'owner', async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) throw bad();
  const amount = Math.round(Number(String(form.get('amount') || '').replace(',', '.')) * 100);
  if (!(amount > 0 && amount < 10_000_000)) throw new AppError('amount', 422, sq.g.amount);
  const date = String(form.get('date') || '');
  if (!isDate(date)) throw bad();
  const cat = String(form.get('category') || 'tjeter');
  const category = (EXPENSE_CATS as readonly string[]).includes(cat) ? cat : 'tjeter';
  const note = String(form.get('note') || '').trim().slice(0, 120);
  const id = randomId(16);
  let receiptKey = '';
  const file = form.get('receipt');
  if (file instanceof File && file.size > 0) {
    if (file.size > 12e6) throw new AppError('photo_type', 415, sq.errors.photo_type);
    let jpg: Buffer;
    try { jpg = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: 'none' }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(); }
    catch { throw new AppError('photo_type', 415, sq.errors.photo_type); }
    receiptKey = `exp/${c.biz.id}/${id}.jpg`;
    await putFile(receiptKey, jpg);
  }
  await db.expense.create({ data: { id, businessId: c.biz.id, date, amountCents: amount, category, note, receiptKey } });
  return { ok: true };
});

route('DELETE', '/expenses/:id', 'owner', async (c) => {
  const e = await db.expense.findFirst({ where: { id: c.params.id, businessId: c.biz.id } });
  if (!e) throw new AppError('not_found', 404, sq.errors.not_found);
  await db.expense.delete({ where: { id: e.id } });
  if (e.receiptKey) await removeFiles(e.receiptKey).catch(() => undefined);
  return { ok: true };
});

route('GET', '/expenses/:id/receipt', 'owner', async (c) => {
  const e = await db.expense.findFirst({ where: { id: c.params.id, businessId: c.biz.id } });
  const data = e?.receiptKey ? await getFile(e.receiptKey) : null;
  if (!data) throw new AppError('not_found', 404, sq.errors.not_found);
  return new Response(new Uint8Array(data), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store' } });
});

route('GET', '/arka/export.csv', 'owner', async (c) => {
  const month = isMonth(c.query.get('month')) ? c.query.get('month')! : thisMonth(c.biz);
  const csv = moneyCsv(c.biz, await monthMoney(c.biz, month));
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="termini-${c.biz.slug}-${month}.csv"`, 'cache-control': 'private, no-store' } });
});

/* ---- admin: listings, demo flag ------------------------------------------------------------------------------------ */
route('GET', '/admin/listings', 'admin', async (c) => {
  const f = c.query.get('filter') || 'requests';
  const where = f === 'removed' ? { status: 'removed' } : f === 'claimed' ? { status: 'claimed' } : f === 'all' ? { status: 'active' } : { status: 'active', requestsCount: { gt: 0 } };
  const [rows, counts] = await Promise.all([
    db.listing.findMany({ where, orderBy: [{ requestsCount: 'desc' }, { city: 'asc' }, { name: 'asc' }], take: 300, include: { requests: { orderBy: { createdAt: 'desc' }, take: 5 } } }),
    db.listing.groupBy({ by: ['status'], _count: true }),
  ]);
  const withReq = await db.listing.count({ where: { status: 'active', requestsCount: { gt: 0 } } });
  return {
    counts: { active: counts.find((x) => x.status === 'active')?._count || 0, claimed: counts.find((x) => x.status === 'claimed')?._count || 0, removed: counts.find((x) => x.status === 'removed')?._count || 0, withRequests: withReq },
    listings: rows.map((l) => ({
      id: l.id, slug: l.slug, name: l.name, category: l.category, city: l.city, address: l.address, phone: l.phone, phoneDisplay: displayPhone(l.phone),
      status: l.status, source: l.source, requestsCount: l.requestsCount, contactedAt: l.contactedAt?.toISOString() || null, claimRequestPhone: l.claimRequestPhone ? displayPhone(l.claimRequestPhone) : '',
      requests: l.requests.map((r) => ({ name: r.name, phone: displayPhone(r.phone), note: r.note, at: r.createdAt.toISOString() })),
    })),
  };
});

const setListing = (status: string) => async (c: Parameters<Parameters<typeof route>[3]>[0]) => {
  const l = await db.listing.findUnique({ where: { id: c.params.id } });
  if (!l) throw new AppError('not_found', 404, sq.errors.not_found);
  await db.listing.update({ where: { id: l.id }, data: { status } });
  await db.auditLog.create({ data: { userId: c.me.id, action: `listing.${status}`, targetType: 'listing', targetId: l.id } });
  return { ok: true };
};
route('POST', '/admin/listings/:id/remove', 'admin', setListing('removed'));
route('POST', '/admin/listings/:id/restore', 'admin', setListing('active'));
route('POST', '/admin/listings/:id/contacted', 'admin', async (c) => {
  await db.listing.update({ where: { id: c.params.id }, data: { contactedAt: new Date() } });
  return { ok: true };
});
route('POST', '/admin/listings/import', 'admin', async (c) => {
  const { csv } = await c.body<{ csv?: string }>();
  const added = await importListings(parseListingCsv(String(csv || '').slice(0, 200_000)));
  await db.auditLog.create({ data: { userId: c.me.id, action: 'listing.import', targetType: 'listing', targetId: '-', metaJson: JSON.stringify({ added }) } });
  return { added };
});

route('POST', '/admin/businesses/:id/demo', 'admin', async (c) => {
  const { demo } = await c.body<{ demo?: boolean }>();
  const b = await db.business.update({ where: { id: c.params.id }, data: { isDemo: !!demo } }).catch(() => null);
  if (!b) throw new AppError('not_found', 404, sq.errors.not_found);
  await db.auditLog.create({ data: { userId: c.me.id, action: demo ? 'business.demo' : 'business.undemo', targetType: 'business', targetId: b.id } });
  return { ok: true, demo: b.isDemo };
});

/* ---- cron (Vercel calls it once a day with Authorization: Bearer CRON_SECRET) ---------------------------------------- */
route('GET', '/cron/messages', 'public', async (c) => {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || c.req.headers.get('authorization') !== `Bearer ${secret}`) throw new AppError('forbidden', 403, sq.errors.forbidden);
  const r = await planAll();
  log.info('cron.messages', r);
  return NextResponse.json(r);
});
