// v7 automatic messages for the owner's clients:
//   reminder24  the day before the appointment (fewer no-shows)
//   winback     "bring them back": a regular is late compared with their own rhythm (only clients who agreed)
//   review      after the visit: a 1-5 rating; everyone is invited to Google, low ratings can also go privately to the owner
// Termini PREPARES each message (MessageLog, status "queued"). Today the owner sends it with one tap (a wa.me link with
// the text ready). When the WhatsApp Business API is configured (WA_MSG_TOKEN + WA_MSG_PHONE_ID + approved templates),
// sendQueued() sends them by itself. Planning is idempotent: the booking/customer is stamped, so nothing is sent twice.
import type { Business, Customer, MessageLog } from '@prisma/client';
import { bookingTokenUrl, bookingUrl, config } from './config';
import { db } from './db';
import { log, maskPhoneForLog } from './log';
import { waDigits } from './phone';
import { sq } from './sq';
import { addDays, toLocal } from './time';

const DAY = 864e5;
export const WINBACK_MIN_VISITS = 2;
export const WINBACK_COOLDOWN_DAYS = 30;

/** The client's own rhythm: the median number of days between their visits (needs 2+ visits). 7..120 days. */
export function visitRhythmDays(visits: Date[]): number | null {
  const t = [...visits].map((d) => d.getTime()).sort((a, b) => a - b);
  if (t.length < WINBACK_MIN_VISITS) return null;
  const gaps = t.slice(1).map((x, i) => (x - t[i]) / DAY).filter((g) => g >= 3);
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const mid = gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;
  return Math.min(120, Math.max(7, Math.round(mid)));
}

/** Late = more than 25% (and at least 4 days) past their usual rhythm since the last visit. */
export function isLate(lastVisit: Date, rhythmDays: number, now = new Date()): boolean {
  const since = (now.getTime() - lastVisit.getTime()) / DAY;
  return since > rhythmDays + Math.max(4, rhythmDays * 0.25);
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
const origin = () => config.appUrl();
export const reviewUrl = (token: string, o = origin()) => `${o}/v/${token}`;

type Planned = { kind: string; customerId: string | null; bookingId: string | null; text: string };

/** Finds the messages that are due now for one business, stamps them and stores them as queued. Returns how many. */
export async function planMessages(b: Business, now = new Date(), o = origin()): Promise<number> {
  if (b.suspendedAt || b.isDemo) return 0;
  const planned: Planned[] = [];
  const tz = b.timezone;
  const tomorrow = addDays(toLocal(now, tz).date, 1);

  // 1. Day-before reminders: confirmed appointments tomorrow (local date), client has a number.
  if (b.autoReminders) {
    const rows = await db.booking.findMany({
      where: { businessId: b.id, status: 'confirmed', reminder24At: null, reminderSentAt: null, startsAt: { gt: now, lt: new Date(now.getTime() + 2 * DAY) } },
      include: { customer: true },
    });
    for (const r of rows) {
      if (!r.customer.phone || toLocal(r.startsAt, tz).date !== tomorrow) continue;
      planned.push({ kind: 'reminder24', customerId: r.customerId, bookingId: r.id, text: sq.g.msgReminder24({ name: firstName(r.customer.name), business: b.name, time: toLocal(r.startsAt, tz).time, link: bookingTokenUrl(b.slug, r.token, o) }) });
    }
  }

  // 2. Review request: the visit ended between 2 and 48 hours ago and was not cancelled / no-show.
  if (b.reviewAskOn) {
    const rows = await db.booking.findMany({
      where: { businessId: b.id, status: { in: ['confirmed', 'completed'] }, reviewAskedAt: null, endsAt: { lt: new Date(now.getTime() - 2 * 3600e3), gt: new Date(now.getTime() - 2 * DAY) } },
      include: { customer: true },
    });
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.customer.phone || seen.has(r.customerId)) continue;
      seen.add(r.customerId);
      planned.push({ kind: 'review', customerId: r.customerId, bookingId: r.id, text: sq.g.msgReview({ name: firstName(r.customer.name), business: b.name, link: reviewUrl(r.token, o) }) });
    }
  }

  // 3. Bring them back: regulars who agreed, no upcoming booking, late for their own rhythm, not messaged recently.
  if (b.winbackOn) {
    const customers = await db.customer.findMany({
      where: { businessId: b.id, marketingOk: true, blocked: false, phone: { not: null }, visitsCount: { gte: WINBACK_MIN_VISITS }, lastVisitAt: { not: null } },
      include: { bookings: { where: { status: { in: ['confirmed', 'completed', 'pending'] } }, select: { startsAt: true, endsAt: true, status: true } } },
      take: 500,
    });
    for (const c of customers) {
      if (c.bookings.some((x) => x.startsAt > now)) continue;
      if (c.winbackSentAt && (now.getTime() - c.winbackSentAt.getTime() < WINBACK_COOLDOWN_DAYS * DAY || c.winbackSentAt > c.lastVisitAt!)) continue;
      const visits = c.bookings.filter((x) => x.endsAt < now).map((x) => x.startsAt);
      const rhythm = visitRhythmDays(visits);
      if (!rhythm || !isLate(c.lastVisitAt!, rhythm, now)) continue;
      const weeks = Math.max(1, Math.round((now.getTime() - c.lastVisitAt!.getTime()) / (7 * DAY)));
      planned.push({ kind: 'winback', customerId: c.id, bookingId: null, text: sq.g.msgWinback({ name: firstName(c.name), business: b.name, weeks, link: `${bookingUrl(b.slug, o)}?nga=kthim` }) });
    }
  }

  for (const p of planned) {
    await db.$transaction(async (tx) => {
      // Stamp first (and only if still unstamped), so two parallel runs cannot queue the same message twice.
      if (p.kind === 'reminder24') { const r = await tx.booking.updateMany({ where: { id: p.bookingId!, reminder24At: null }, data: { reminder24At: now } }); if (!r.count) return; }
      if (p.kind === 'review') { const r = await tx.booking.updateMany({ where: { id: p.bookingId!, reviewAskedAt: null }, data: { reviewAskedAt: now } }); if (!r.count) return; }
      if (p.kind === 'winback') await tx.customer.update({ where: { id: p.customerId! }, data: { winbackSentAt: now } });
      await tx.messageLog.create({ data: { businessId: b.id, customerId: p.customerId, bookingId: p.bookingId, kind: p.kind, text: p.text } });
    });
  }
  if (planned.length && waApiReady()) await sendQueued(b.id).catch(() => undefined);
  return planned.length;
}

/** Runs the planner for every active business (daily Vercel cron). */
export async function planAll(now = new Date()) {
  const list = await db.business.findMany({ where: { suspendedAt: null, isDemo: false, onboardedAt: { not: null } } });
  let total = 0;
  for (const b of list) total += await planMessages(b, now).catch((e) => { log.error('messages.plan_failed', { business: b.id, error: String(e) }); return 0; });
  // Queued messages older than 3 days are no longer useful (the appointment passed, the moment is gone).
  await db.messageLog.updateMany({ where: { status: 'queued', createdAt: { lt: new Date(now.getTime() - 3 * DAY) } }, data: { status: 'skipped' } });
  return { businesses: list.length, planned: total };
}

/** The owner's outbox: queued messages with the ready wa.me link. */
export async function outbox(b: Business) {
  const rows = await db.messageLog.findMany({ where: { businessId: b.id, status: 'queued' }, orderBy: { createdAt: 'asc' }, take: 100 });
  const ids = rows.map((r) => r.customerId).filter((x): x is string => !!x);
  const customers = new Map((await db.customer.findMany({ where: { id: { in: ids } } })).map((c) => [c.id, c] as [string, Customer]));
  return rows.flatMap((r) => {
    const c = r.customerId ? customers.get(r.customerId) : null;
    if (!c?.phone) return [];
    return [{ id: r.id, kind: r.kind, name: c.name, text: r.text, url: `https://wa.me/${waDigits(c.phone)}?text=${encodeURIComponent(r.text)}` }];
  });
}

export async function markMessage(b: Business, id: string, status: 'sent' | 'skipped') {
  const r = await db.messageLog.updateMany({ where: { id, businessId: b.id, status: 'queued' }, data: { status, sentAt: status === 'sent' ? new Date() : null } });
  return r.count > 0;
}

/* ---- WhatsApp Business API (optional, automatic sending) -------------------------------------------------------- */
// Needs one Meta-approved "utility" template per kind (WA_TPL_REMINDER, WA_TPL_WINBACK, WA_TPL_REVIEW). Meta does not
// allow a template that is only one big variable, so each template takes these variables in this order:
//   reminder: {{1}} first name, {{2}} business, {{3}} time, {{4}} cancel link
//   review:   {{1}} first name, {{2}} business, {{3}} rating link      winback: {{1}} first name, {{2}} business, {{3}} booking link
const env = (k: string) => (process.env[k] || '').trim();
export const waApiReady = () => !!(env('WA_MSG_TOKEN') && env('WA_MSG_PHONE_ID') && env('WA_TPL_REMINDER'));

export function buildWaMessage(m: Pick<MessageLog, 'kind'>, to: string, params: string[]) {
  const tpl = m.kind === 'reminder24' ? env('WA_TPL_REMINDER') : m.kind === 'winback' ? env('WA_TPL_WINBACK') : env('WA_TPL_REVIEW');
  return {
    url: `https://graph.facebook.com/${env('WHATSAPP_API_VERSION') || 'v21.0'}/${env('WA_MSG_PHONE_ID')}/messages`,
    template: tpl,
    body: { messaging_product: 'whatsapp', to: waDigits(to), type: 'template', template: { name: tpl, language: { code: env('WA_TPL_LANG') || 'sq' }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] } },
  };
}

/** Sends queued messages through the API when it is configured; on any failure the message stays queued for the owner. */
export async function sendQueued(businessId: string) {
  if (!waApiReady()) return 0;
  const b = await db.business.findUnique({ where: { id: businessId } });
  if (!b) return 0;
  const rows = await db.messageLog.findMany({ where: { businessId, status: 'queued' }, take: 50 });
  let sent = 0;
  for (const m of rows) {
    const c = m.customerId ? await db.customer.findUnique({ where: { id: m.customerId } }) : null;
    const booking = m.bookingId ? await db.booking.findUnique({ where: { id: m.bookingId } }) : null;
    if (!c?.phone) continue;
    const name = firstName(c.name);
    const params = m.kind === 'reminder24' && booking ? [name, b.name, toLocal(booking.startsAt, b.timezone).time, bookingTokenUrl(b.slug, booking.token)]
      : m.kind === 'review' && booking ? [name, b.name, reviewUrl(booking.token)]
      : [name, b.name, `${bookingUrl(b.slug)}?nga=kthim`];
    const req = buildWaMessage(m, c.phone, params);
    if (!req.template) continue;
    try {
      const res = await fetch(req.url, { method: 'POST', headers: { authorization: `Bearer ${env('WA_MSG_TOKEN')}`, 'content-type': 'application/json' }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(10_000) });
      if (res.ok) { await db.messageLog.update({ where: { id: m.id }, data: { status: 'sent', channel: 'whatsapp', sentAt: new Date() } }); sent++; }
      else log.warn('messages.wa_failed', { to: maskPhoneForLog(c.phone), status: res.status });
    } catch (e) { log.warn('messages.wa_failed', { to: maskPhoneForLog(c.phone), error: String(e) }); }
  }
  return sent;
}
