// Payments for Faqja Gati (100 € once). Stripe and PayPal do not work for Kosovo businesses, so:
//   · Paysera checkout (card / bank link): interface below, active only when the keys are in .env
//   · bank transfer and cash: a pending payment with a reference code; an admin marks it paid in /admin
//
// TODO(production) Paysera: create a project at https://www.paysera.com, put PAYSERA_PROJECT_ID and
// PAYSERA_SIGN_PASSWORD in .env, set PAYSERA_TEST=0, and test one real payment end to end.
// Docs: https://developers.paysera.com/en/checkout/basic  (request: data + sign; callback: data + ss1 + ss2).
// The request/callback code follows the documented "data = base64url(query), sign = md5(data + password)"
// scheme but has NOT been run against Paysera from this machine; verify it before taking money.
import { createHash, createVerify } from 'node:crypto';
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
const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

export const paysera: PaymentProvider = {
  id: 'paysera',
  configured: () => !!config.payseraProjectId() && !!config.payseraPassword(),

  createCheckout(req) {
    const query = new URLSearchParams({
      projectid: config.payseraProjectId(), orderid: req.orderId, version: '1.6', lang: 'ENG',
      amount: String(req.amountCents), currency: 'EUR', paytext: req.description,
      accepturl: req.acceptUrl, cancelurl: req.cancelUrl, callbackurl: req.callbackUrl,
      test: config.payseraTest() ? '1' : '0',
    }).toString();
    const data = b64url(query);
    return { redirectUrl: `https://www.paysera.com/pay/?data=${data}&sign=${md5(data + config.payseraPassword())}` };
  },

  verifyCallback(params) {
    const data = params.get('data') || '';
    const fail: CallbackResult = { ok: false, orderId: '', amountCents: 0, paid: false, providerRef: '' };
    if (!this.configured() || !data || params.get('ss1') !== md5(data + config.payseraPassword())) return fail;
    // ss2 = RSA-SHA1 signature of `data` with Paysera's key (https://www.paysera.com/download/public.key).
    // Required in production: put the PEM in PAYSERA_PUBLIC_KEY.
    const pem = (process.env.PAYSERA_PUBLIC_KEY || '').replace(/\\n/g, '\n');
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
    if ((q.get('currency') || q.get('pay_currency') || 'EUR') !== 'EUR') return fail;
    if (prod && !config.payseraTest() && q.get('test') === '1') return fail;   // never accept a test payment as real money
    return { ok: true, orderId: q.get('orderid') || '', amountCents: Number(q.get('amount') || 0), paid: q.get('status') === '1', providerRef: q.get('requestid') || '' };
  },
};

export const METHODS = ['paysera', 'bank', 'cash'] as const;
export type Method = (typeof METHODS)[number];
export const isMethod = (m: unknown): m is Method => typeof m === 'string' && (METHODS as readonly string[]).includes(m);
