// Payments for Faqja Gati (100 € once). Stripe and PayPal do not work for Kosovo businesses, so:
//   · Paysera checkout (card / bank link): interface below, active only when the keys are in .env
//   · bank transfer and cash: a pending payment with a reference code; an admin marks it paid in /admin
//
// Every Paysera setting is an environment variable (PAYSERA_PROJECT_ID, PAYSERA_SIGN_PASSWORD,
// PAYSERA_PUBLIC_KEY, PAYSERA_TEST, PAYSERA_LANG, PAYSERA_PAY_URL): see .env.example and the
// test-payment checklist in GO-ONLINE.md.
// Docs: https://developers.paysera.com/en/checkout/basic  (request: data + sign; callback: data + ss1 + ss2).
// The request/callback code follows the documented "data = base64url(query), sign = md5(data + password)"
// scheme but has NOT been run against Paysera from this machine; verify it before taking money.
import { createHash, createVerify, timingSafeEqual } from 'node:crypto';
import { config } from './config';

export type CheckoutRequest = { orderId: string; amountCents: number; description: string; acceptUrl: string; cancelUrl: string; callbackUrl: string };
export type CallbackResult = { ok: boolean; orderId: string; amountCents: number; paid: boolean; providerRef: string };

export interface PaymentProvider {
  id: 'paysera';
  configured(): boolean;
  createCheckout(req: CheckoutRequest): { redirectUrl: string };
  verifyCallback(params: URLSearchParams): CallbackResult;
}

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
/** Compare two short texts without leaking where they differ. */
const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

export const paysera: PaymentProvider = {
  id: 'paysera',
  configured: () => !!config.payseraProjectId() && !!config.payseraPassword(),

  createCheckout(req) {
    const query = new URLSearchParams({
      projectid: config.payseraProjectId(), orderid: req.orderId, version: '1.6', lang: config.payseraLang(),
      amount: String(req.amountCents), currency: 'EUR', paytext: req.description,
      accepturl: req.acceptUrl, cancelurl: req.cancelUrl, callbackurl: req.callbackUrl,
      test: config.payseraTest() ? '1' : '0',
    }).toString();
    const data = b64url(query);
    return { redirectUrl: `${config.payseraPayUrl()}?data=${data}&sign=${md5(data + config.payseraPassword())}` };
  },

  verifyCallback(params) {
    const data = params.get('data') || '';
    const fail: CallbackResult = { ok: false, orderId: '', amountCents: 0, paid: false, providerRef: '' };
    if (!this.configured() || !data || !sameText(params.get('ss1') || '', md5(data + config.payseraPassword()))) return fail;
    // ss2 = RSA-SHA1 signature of `data` with Paysera's key (https://www.paysera.com/download/public.key).
    // Required in production: put the PEM in PAYSERA_PUBLIC_KEY.
    const pem = config.payseraPublicKey();
    const prod = process.env.NODE_ENV === 'production';
    if (pem) {
      const ss2 = (params.get('ss2') || '').replace(/-/g, '+').replace(/_/g, '/');
      const v = createVerify('RSA-SHA1'); v.update(data);
      let good = false;
      try { good = !!ss2 && v.verify(pem, ss2, 'base64'); } catch { good = false; }
      if (!good) return fail;
    } else if (prod) return fail;
    const q = new URLSearchParams(unb64url(data));
    if (q.get('projectid') !== config.payseraProjectId()) return fail;
    if ((q.get('currency') || 'EUR') !== 'EUR') return fail;
    // v4 audit: `amount` is what we asked for; `payamount` / `paycurrency` are what was really paid.
    // The smaller of the two counts, and it must be in euros.
    const payCurrency = q.get('paycurrency') || q.get('pay_currency') || '';
    if (payCurrency && payCurrency !== 'EUR') return fail;
    const asked = Number(q.get('amount') || 0);
    const paidAmount = q.get('payamount') ? Number(q.get('payamount')) : asked;
    const amountCents = Number.isFinite(asked) && Number.isFinite(paidAmount) ? Math.min(asked, paidAmount) : 0;
    // Never accept a test payment as real money. v4 audit: in production a test payment counts only while test mode is on
    // AND the site is private (SITE_PASSWORD); on a public site test mode would let anyone publish a page for free.
    if (prod && q.get('test') === '1' && !(config.payseraTest() && (process.env.SITE_PASSWORD || '').trim())) return fail;
    return { ok: true, orderId: q.get('orderid') || '', amountCents, paid: q.get('status') === '1', providerRef: q.get('requestid') || '' };
  },
};

export const METHODS = ['paysera', 'bank', 'cash'] as const;
export type Method = (typeof METHODS)[number];
export const isMethod = (m: unknown): m is Method => typeof m === 'string' && (METHODS as readonly string[]).includes(m);
