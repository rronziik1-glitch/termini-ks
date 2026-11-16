// Faqja Gati pages: draft → generating → preview → payment_pending → live (paid = paid but unpublished).
// The preview and the live page are produced by two separate functions; the live one refuses every
// status except "live", and nothing in a request (query, cookie, header) can change that.
import type { Page, PageAsset } from '@prisma/client';
import { AppError, db } from './db';
import { bookingUrl, config, ipHash, randomId, rateLimit } from './config';
import { fillContent } from './ai';
import { removePageFiles, saveUpload } from './fg/images';
import { assignPhotos, renderLive, renderPreview } from './fg/render';
import { isTemplate, validateContent, VARIANTS, type Content, type Template } from './fg/schema';
import { isMethod, paysera, type Method } from './payments';
import { normalizePhone } from './phone';
import { isValidSlug, slugify } from './slug';
import { sq } from './sq';

export const MAX_PHOTOS = 10;
export const MAX_REVISIONS = 3;
export const PREVIEW_DAYS = 14;
export const STAGES = ['read', 'write', 'photos', 'build'] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const notFound = () => new AppError('not_found', 404, sq.fg.notFoundTitle);

export type CreatePageInput = {
  template?: string; name?: string; city?: string; text?: string; oldUrl?: string; contactPhone?: string;
  ip?: string; userId?: string | null; businessId?: string | null;
};

export async function createPage(input: CreatePageInput): Promise<Page> {
  const name = (input.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 2) throw new AppError('business_name', 422, sq.errors.business_name);
  const text = (input.text || '').trim().slice(0, 4000);
  if (text.length < 20) throw new AppError('about_short', 422, sq.fg.aboutError);
  const phone = normalizePhone(input.contactPhone);
  if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
  const template = isTemplate(input.template) ? input.template : 'auto';
  const iph = ipHash(input.ip || 'local');
  const since = new Date(Date.now() - 864e5);
  const [byPhone, byIp] = await Promise.all([
    db.page.count({ where: { contactPhone: phone, createdAt: { gt: since } } }),
    db.page.count({ where: { createdIpHash: iph, createdAt: { gt: since } } }),
  ]);
  if (byPhone >= 3 || (byIp >= 10 && process.env.NODE_ENV === 'production')) throw new AppError('pages_limit', 429, sq.errors.pages_limit);

  let businessId = input.businessId || null;
  if (!businessId) businessId = (await db.business.findFirst({ where: { OR: [{ phone }, { whatsapp: phone }] }, select: { id: true } }))?.id || null;
  let oldUrl = (input.oldUrl || '').trim().slice(0, 300);
  if (oldUrl && !/^https?:\/\//i.test(oldUrl)) oldUrl = 'https://' + oldUrl;
  return db.page.create({
    data: {
      id: randomId(20), template, inputName: name, inputCategory: template, inputCity: (input.city || '').trim().slice(0, 40) || 'Prishtinë',
      inputText: text, inputOldUrl: oldUrl, contactPhone: phone, createdIpHash: iph, ownerUserId: input.userId || null, businessId,
    },
  });
}

export async function getPage(id: string) {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw notFound();
  return page;
}

const editable = (p: Page) => ['draft', 'preview', 'failed', 'expired', 'payment_pending'].includes(p.status);

export async function addAsset(pageId: string, data: Buffer): Promise<PageAsset> {
  const page = await getPage(pageId);
  if (!editable(page)) throw new AppError('forbidden', 403, sq.errors.forbidden);
  const count = await db.pageAsset.count({ where: { pageId } });
  if (count >= MAX_PHOTOS) throw new AppError('photo_max', 422, sq.errors.photo_max);
  const saved = await saveUpload(pageId, data);
  return db.pageAsset.create({ data: { pageId, sort: count, slot: count === 0 ? 'hero' : count === 1 ? 'about' : 'gallery', ...saved } });
}

export async function reorderAssets(pageId: string, ids: string[]) {
  const page = await getPage(pageId);
  if (!editable(page)) throw new AppError('forbidden', 403, sq.errors.forbidden);
  const assets = await db.pageAsset.findMany({ where: { pageId } });
  const order = ids.filter((id) => assets.some((a) => a.id === id));
  await db.$transaction(order.map((id, i) => db.pageAsset.update({ where: { id }, data: { sort: i, slot: i === 0 ? 'hero' : i === 1 ? 'about' : 'gallery' } })));
}

/* ---- old website text ---------------------------------------------------------- */
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1|\[?f[cd])/i;
/** true for loopback, private, link-local, CGNAT, multicast and IPv4-mapped private addresses. */
function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const [a, b] = v.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('::ffff:');
}

/** Audit fix (SSRF): the hostname regex alone was bypassed by redirects and by public names that resolve to
 *  private IPs (e.g. 127.0.0.1.nip.io). Now every hop is resolved and checked, and redirects are followed by hand. */
async function safePublicUrl(raw: string | URL): Promise<URL | null> {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname) || /instagram\.com|facebook\.com|fb\.com/i.test(u.hostname)) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const { lookup } = await import('node:dns/promises');
  const addrs = await lookup(u.hostname.replace(/^\[|\]$/g, ''), { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return null;
  return u;
}

export async function fetchOldSite(url: string): Promise<string | null> {
  try {
    let u = await safePublicUrl(url);
    let res: Response | null = null;
    for (let hop = 0; u && hop < 4; hop++) {
      res = await fetch(u, { signal: AbortSignal.timeout(8000), redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; FaqjaGati/1.0)' } });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!loc) break;
      u = await safePublicUrl(new URL(loc, u));
      res = null;
    }
    if (!res || !res.ok || !/text\/html|text\/plain/i.test(res.headers.get('content-type') || '')) return null;
    const html = (await res.text()).slice(0, 400_000);
    const text = html
      .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    return text.length > 40 ? text.slice(0, 6000) : null;
  } catch {
    return null;
  }
}

/* ---- generation ------------------------------------------------------------------ */
export type GenerateOptions = { revisionNote?: string; text?: string; themeVariant?: string };

/** Starts generation and returns at once; the progress screen polls getStatus. */
export async function startGeneration(pageId: string, opts: GenerateOptions = {}, origin?: string): Promise<Page> {
  const page = await getPage(pageId);
  if (!editable(page)) throw new AppError('forbidden', 403, sq.errors.forbidden);

  // "Provo stil tjetër": a colour variant of the same template; no regeneration needed.
  if (opts.themeVariant !== undefined && !opts.revisionNote && opts.text === undefined) {
    const variant = VARIANTS.includes(opts.themeVariant) ? opts.themeVariant : '';
    if (!page.contentJson) throw new AppError('bad_request', 400, sq.errors.bad_request);
    const content = JSON.parse(page.contentJson) as Content;
    content.theme = { ...(content.theme || {}), variant };
    return db.page.update({ where: { id: pageId }, data: { themeVariant: variant, contentJson: JSON.stringify(content) } });
  }

  const isRevision = !!page.contentJson && page.status !== 'failed' && page.status !== 'expired';
  if (isRevision && page.revisionsUsed >= MAX_REVISIONS) throw new AppError('revisions_used', 429, sq.errors.revisions_used);
  const text = opts.text !== undefined ? opts.text.trim().slice(0, 4000) : page.inputText;
  if (text.length < 20) throw new AppError('about_short', 422, sq.fg.aboutError);
  // Audit M6: global daily cap on AI generations (each one is a paid Claude call).
  const cap = Number(process.env.FG_DAILY_CAP || 200);
  if (!rateLimit('fg:generations', cap, 24 * 3600e3)) throw new AppError('daily_cap', 429, sq.errors.daily_cap);
  // Audit S4: the revision limit is checked and counted in one atomic write (two quick taps can't both pass).
  const res = await db.page.updateMany({
    where: { id: pageId, ...(isRevision ? { revisionsUsed: { lt: MAX_REVISIONS } } : {}) },
    data: { status: 'generating', stage: 'read', inputText: text, notice: '', ...(isRevision ? { revisionsUsed: { increment: 1 } } : {}) },
  });
  if (res.count === 0) throw new AppError('revisions_used', 429, sq.errors.revisions_used);
  const updated = await getPage(pageId);
  void runGeneration(pageId, { ...opts, text }, origin).catch((e) => console.error('[faqja-gati] generation crashed', e));
  return updated;
}

/** The job itself. Exported for the seed and the tests (they await it). */
export async function runGeneration(pageId: string, opts: GenerateOptions = {}, origin?: string): Promise<Page> {
  const delay = config.stageDelayMs();
  const setStage = (stage: string) => db.page.update({ where: { id: pageId }, data: { status: 'generating', stage } });
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      let page = await setStage('read');
      let oldSiteText = '';
      let notice = '';
      if (page.inputOldUrl) {
        const t = await fetchOldSite(page.inputOldUrl);
        if (t) oldSiteText = t; else notice = sq.fg.oldUrlFailed;
      }
      await sleep(delay);

      page = await setStage('write');
      const business = page.businessId ? await db.business.findUnique({ where: { id: page.businessId } }) : null;
      const assets = await db.pageAsset.findMany({ where: { pageId }, orderBy: { sort: 'asc' } });
      const previous = page.contentJson ? (JSON.parse(page.contentJson) as Content) : null;
      const result = await fillContent({
        template: isTemplate(page.template) ? page.template : 'auto', name: page.inputName, city: page.inputCity, text: page.inputText,
        oldSiteText, photoCount: assets.length, contactPhone: page.contactPhone,
        bookingUrl: business ? bookingUrl(business.slug, origin) : '', revisionNote: opts.revisionNote, previous,
      });
      const content = result.content;
      content.theme = { ...(content.theme || {}), variant: VARIANTS.includes(page.themeVariant) ? page.themeVariant : '' };
      const problems = validateContent(content);
      if (problems.length) throw new Error('content invalid: ' + problems.join('; '));
      await db.pageGeneration.create({
        data: { pageId, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, ok: result.ok, error: result.error.slice(0, 500), revisionNote: opts.revisionNote || '', durationMs: Date.now() - started },
      });
      await sleep(delay);

      await setStage('photos');
      await sleep(delay);

      await setStage('build');
      renderPreview(assignPhotos(content, assets.map((a) => previewImageUrl(pageId, a.id))));   // must render without throwing
      await sleep(delay);

      return await db.page.update({
        where: { id: pageId },
        data: { status: 'preview', stage: '', template: content.meta.template, contentJson: JSON.stringify(content), notice, previewExpiresAt: new Date(Date.now() + PREVIEW_DAYS * 864e5) },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.pageGeneration.create({ data: { pageId, model: 'error', ok: false, error: message.slice(0, 500), durationMs: Date.now() - started } }).catch(() => undefined);
      if (attempt >= 2) return db.page.update({ where: { id: pageId }, data: { status: 'failed', stage: '' } });   // one automatic retry
    }
  }
}

/** preview → expired after 14 days (checked whenever the page is read). */
export async function refreshExpiry(page: Page): Promise<Page> {
  if (page.status === 'preview' && page.previewExpiresAt && page.previewExpiresAt < new Date()) {
    return db.page.update({ where: { id: page.id }, data: { status: 'expired' } });
  }
  return page;
}

export async function getStatus(pageId: string) {
  const page = await refreshExpiry(await getPage(pageId));
  const i = STAGES.indexOf(page.stage as (typeof STAGES)[number]);
  return { status: page.status, stage: page.stage, progress: page.status === 'generating' ? Math.max(0, i) / STAGES.length : 1, updatedAt: page.updatedAt.getTime(), notice: page.notice };
}

/* ---- rendering -------------------------------------------------------------------- */
export const previewImageUrl = (pageId: string, assetId: string) => `/faqja/${pageId}/img/${assetId}`;
export const liveImageUrl = (subdomain: string, assetId: string) => `/p/${subdomain}/img/${assetId}`;
const PREVIEWABLE = ['preview', 'payment_pending', 'paid', 'live'];

/** Watermarked preview HTML. Always the preview path, whatever the status. */
export async function previewHtml(pageId: string): Promise<string> {
  const page = await refreshExpiry(await getPage(pageId));
  if (page.status === 'expired') throw new AppError('preview_expired', 410, sq.errors.preview_expired);
  if (!PREVIEWABLE.includes(page.status) || !page.contentJson) throw notFound();
  const assets = await db.pageAsset.findMany({ where: { pageId }, orderBy: { sort: 'asc' } });
  return renderPreview(assignPhotos(JSON.parse(page.contentJson) as Content, assets.map((a) => previewImageUrl(pageId, a.id))));
}

/** The published page. Returns null unless the page is live: this is the payment gate. */
export async function liveHtml(subdomain: string, origin?: string): Promise<string | null> {
  const page = await db.page.findUnique({ where: { subdomain }, include: { business: true, assets: { orderBy: { sort: 'asc' } } } });
  if (!page || page.status !== 'live' || !page.contentJson) return null;
  const content = JSON.parse(page.contentJson) as Content;
  const b = page.business;
  content.booking = b && !b.bookingsPaused
    ? { enabled: true, url: `${bookingUrl(b.slug, origin)}?nga=faqja`, label: content.booking?.label || '' }
    : { enabled: false, url: '', label: content.booking?.label || '' };
  return renderLive(assignPhotos(content, page.assets.map((a) => liveImageUrl(subdomain, a.id))));
}

/** Full-quality photo of a live page; null for anything that is not live. */
export async function liveAssetKey(subdomain: string, assetId: string): Promise<string | null> {
  const page = await db.page.findUnique({ where: { subdomain }, select: { id: true, status: true } });
  if (!page || page.status !== 'live') return null;
  const asset = await db.pageAsset.findFirst({ where: { id: assetId, pageId: page.id } });
  return asset?.storageKey || null;
}

/** Watermarked derivative; the only image a preview can ever load. */
export async function previewAssetKey(pageId: string, assetId: string): Promise<string | null> {
  const asset = await db.pageAsset.findFirst({ where: { id: assetId, pageId } });
  return asset?.previewKey || null;
}

/* ---- checkout and payment ------------------------------------------------------------ */
const subdomainTaken = async (s: string, exceptId: string) => !!(await db.page.findFirst({ where: { subdomain: s, NOT: { id: exceptId } }, select: { id: true } }));

export async function freeSubdomain(page: Pick<Page, 'id' | 'inputName' | 'inputCity'>, wanted?: string): Promise<string> {
  const base = slugify(wanted || page.inputName) || 'faqja';
  const tries = [base, slugify(`${base} ${page.inputCity}`)];
  for (let n = 2; n < 50; n++) tries.push(`${base.slice(0, 36)}-${n}`);
  for (const s of tries) if (isValidSlug(s) && !(await subdomainTaken(s, page.id))) return s;
  return `${base.slice(0, 28)}-${randomId(6).toLowerCase()}`;
}

export const paymentReference = (pageId: string) => `FG-${pageId.slice(0, 6).toUpperCase()}`;

export type CheckoutInput = { method?: string; subdomain?: string; customDomain?: string };

export async function checkout(pageId: string, input: CheckoutInput, origin: string) {
  const page = await refreshExpiry(await getPage(pageId));
  if (!['preview', 'payment_pending'].includes(page.status)) throw new AppError('forbidden', 403, page.status === 'expired' ? sq.errors.preview_expired : sq.errors.forbidden);
  if (!isMethod(input.method)) throw new AppError('bad_request', 400, sq.fg.pickMethod);
  const method: Method = input.method;
  if (method === 'paysera' && !paysera.configured()) throw new AppError('paysera_off', 409, sq.fg.payseraSoon);

  const wanted = slugify(input.subdomain || '');
  if (wanted && (!isValidSlug(wanted) || (await subdomainTaken(wanted, page.id)))) throw new AppError('subdomain_taken', 409, sq.errors.subdomain_taken);
  const subdomain = wanted || page.subdomain || (await freeSubdomain(page));
  const customDomain = (input.customDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 80) || null;
  const amountCents = config.pagePriceCents() + (customDomain ? config.domainPriceCents() : 0);
  const reference = paymentReference(page.id);

  await db.$transaction(async (tx) => {
    await tx.payment.updateMany({ where: { pageId, status: 'pending' }, data: { status: 'failed' } });
    await tx.payment.create({ data: { pageId, amountCents, method, reference } });
    await tx.page.update({ where: { id: pageId }, data: { status: 'payment_pending', subdomain, customDomain } });
  });

  let redirectUrl = '';
  if (method === 'paysera') {
    redirectUrl = paysera.createCheckout({
      orderId: page.id, amountCents, description: `Faqja Gati ${reference}`,
      acceptUrl: `${origin}/faqja/${page.id}`, cancelUrl: `${origin}/faqja/${page.id}?hapi=pagesa`, callbackUrl: `${origin}/api/payments/paysera/callback`,
    }).redirectUrl;
  }
  return { method, reference, amountCents, subdomain, redirectUrl };
}

/** Marks the page paid and publishes it. Called by an admin (bank/cash) or by the Paysera callback. */
export async function markPaid(pageId: string, opts: { method?: string; note?: string; adminUserId?: string | null; providerRef?: string } = {}) {
  const page = await getPage(pageId);
  // Paysera retries callbacks: the same provider reference must not be processed twice.
  if (opts.providerRef && (await db.payment.findFirst({ where: { pageId, status: 'paid', providerRef: opts.providerRef } }))) return page;
  if (!page.contentJson || ['draft', 'generating', 'failed'].includes(page.status)) throw new AppError('bad_request', 400, sq.errors.bad_request);
  const subdomain = page.subdomain || (await freeSubdomain(page));
  return db.$transaction(async (tx) => {
    const pending = await tx.payment.findFirst({ where: { pageId, status: 'pending' }, orderBy: { createdAt: 'desc' } });
    const method = isMethod(opts.method) ? opts.method : pending?.method || 'cash';
    const data = { status: 'paid', method, paidAt: new Date(), markedByUserId: opts.adminUserId || null, providerRef: opts.providerRef || '' };
    if (pending) await tx.payment.update({ where: { id: pending.id }, data });
    else if (!(await tx.payment.findFirst({ where: { pageId, status: 'paid' } }))) {
      await tx.payment.create({ data: { pageId, amountCents: config.pagePriceCents() + (page.customDomain ? config.domainPriceCents() : 0), reference: paymentReference(pageId), ...data } });
    }
    await tx.auditLog.create({ data: { userId: opts.adminUserId || null, action: 'page.mark_paid', targetType: 'page', targetId: pageId, metaJson: JSON.stringify({ method, note: opts.note || '', providerRef: opts.providerRef || '' }) } });
    return tx.page.update({ where: { id: pageId }, data: { status: 'live', subdomain, publishedAt: page.publishedAt || new Date() } });
  });
}

export async function setPublished(pageId: string, live: boolean, adminUserId: string) {
  const page = await getPage(pageId);
  const paid = await db.payment.findFirst({ where: { pageId, status: 'paid' } });
  if (!paid || !['paid', 'live'].includes(page.status)) throw new AppError('bad_request', 400, sq.errors.bad_request);
  await db.auditLog.create({ data: { userId: adminUserId, action: live ? 'page.publish' : 'page.unpublish', targetType: 'page', targetId: pageId } });
  return db.page.update({ where: { id: pageId }, data: { status: live ? 'live' : 'paid', publishedAt: live ? page.publishedAt || new Date() : page.publishedAt } });
}

export async function saveContent(pageId: string, raw: unknown, adminUserId: string) {
  const page = await getPage(pageId);
  let content: Content;
  try { content = typeof raw === 'string' ? JSON.parse(raw) : (raw as Content); } catch { throw new AppError('bad_json', 422, 'JSON i pavlefshëm.'); }
  const problems = validateContent(content);
  if (problems.length) throw new AppError('invalid_content', 422, problems.join('\n'));
  await db.auditLog.create({ data: { userId: adminUserId, action: 'page.edit_content', targetType: 'page', targetId: pageId } });
  return db.page.update({ where: { id: pageId }, data: { contentJson: JSON.stringify(content), template: content.meta.template as Template, themeVariant: content.theme?.variant || '' } });
}

export async function deletePage(pageId: string, adminUserId: string) {
  await getPage(pageId);
  await db.page.delete({ where: { id: pageId } });
  await removePageFiles(pageId);
  await db.auditLog.create({ data: { userId: adminUserId, action: 'page.delete', targetType: 'page', targetId: pageId } });
}
