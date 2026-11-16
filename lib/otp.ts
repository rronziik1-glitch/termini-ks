// Delivery of login codes (OTP). One interface, three providers, chosen by OTP_PROVIDER:
//   dev       nothing is sent; the code is shown on screen and logged (development only)
//   sms       a generic HTTP SMS gateway. SMS_STYLE picks the request shape:
//               twilio   https://www.twilio.com/docs/messaging/api/message-resource
//               infobip  https://www.infobip.com/docs/api/channels/sms
//               generic  any gateway: you give the URL, the headers and a body template
//   whatsapp  WhatsApp Cloud API, with an approved "authentication" template
//             https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates
//
// NOTE: only "dev" has been run on this machine. The others follow the providers' documented requests;
// send one real code to your own phone before launch (GO-ONLINE.md, step "Login codes").
import { log, maskPhoneForLog } from './log';

export const OTP_PROVIDERS = ['dev', 'sms', 'whatsapp'] as const;
export type OtpProviderId = (typeof OTP_PROVIDERS)[number];

const env = (k: string, d = '') => (process.env[k] ?? d).trim();

export function otpProviderId(): OtpProviderId {
  const v = env('OTP_PROVIDER', 'dev').toLowerCase();
  return (OTP_PROVIDERS as readonly string[]).includes(v) ? (v as OtpProviderId) : 'dev';
}

/** The text of the SMS. {code} is replaced. Keep it short: one SMS segment is 160 characters (70 with ë/ç). */
export const otpText = (code: string) => env('OTP_TEXT', 'Kodi yt per Termini: {code}. Vlen 10 minuta.').replace('{code}', code);

export type HttpRequest = { url: string; method: string; headers: Record<string, string>; body: string };

/** Builds the HTTP request for one message. Pure, so the tests can check every shape without a network. */
export function buildOtpRequest(provider: Exclude<OtpProviderId, 'dev'>, to: string, code: string): HttpRequest {
  const digits = to.replace(/\D/g, '');          // 38349123456
  const e164 = '+' + digits;                      // +38349123456
  const text = otpText(code);

  if (provider === 'whatsapp') {
    const version = env('WHATSAPP_API_VERSION', 'v21.0');
    return {
      url: `https://graph.facebook.com/${version}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
      method: 'POST',
      headers: { authorization: `Bearer ${env('WHATSAPP_API_TOKEN')}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: digits, type: 'template',
        template: {
          name: env('WHATSAPP_OTP_TEMPLATE', 'login_code'),
          language: { code: env('WHATSAPP_OTP_LANG', 'sq') },
          // Authentication templates take the code twice: in the text and in the "copy code" button.
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    };
  }

  const style = env('SMS_STYLE', 'generic').toLowerCase();
  const from = env('SMS_FROM', 'Termini');
  if (style === 'twilio') {
    const sid = env('SMS_ACCOUNT_ID');
    return {
      url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${env('SMS_API_KEY')}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e164, From: from, Body: text }).toString(),
    };
  }
  if (style === 'infobip') {
    return {
      url: `${env('SMS_API_URL').replace(/\/$/, '')}/sms/2/text/advanced`,
      method: 'POST',
      headers: { authorization: `App ${env('SMS_API_KEY')}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ messages: [{ from, destinations: [{ to: digits }], text }] }),
    };
  }
  // generic: SMS_API_BODY is a template; {to} {to_plus} {text} {from} {code} {key} are replaced (JSON-escaped).
  const fill = (tpl: string, json: boolean) => {
    const esc = (s: string) => (json ? JSON.stringify(s).slice(1, -1) : s);
    return tpl.replace(/\{to_plus\}/g, esc(e164)).replace(/\{to\}/g, esc(digits)).replace(/\{text\}/g, esc(text))
      .replace(/\{from\}/g, esc(from)).replace(/\{code\}/g, esc(code)).replace(/\{key\}/g, esc(env('SMS_API_KEY')));
  };
  let headers: Record<string, string> = { 'content-type': 'application/json' };
  try { headers = { ...headers, ...JSON.parse(fill(env('SMS_API_HEADERS', '{}'), true)) }; } catch { /* reported by the env check */ }
  return {
    url: env('SMS_API_URL'),
    method: env('SMS_API_METHOD', 'POST').toUpperCase(),
    headers,
    body: fill(env('SMS_API_BODY', '{"to":"{to_plus}","from":"{from}","text":"{text}"}'), true),
  };
}

/** Countries a login code may be sent to: OTP_ALLOWED_PREFIXES, comma separated (default Kosovo and Albania). "*" = any. */
export function otpAllowedFor(phone: string): boolean {
  const list = env('OTP_ALLOWED_PREFIXES', '+383,+355').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes('*') || list.some((p) => phone.startsWith(p.startsWith('+') ? p : '+' + p));
}

export class OtpSendError extends Error {}

/** Sends the login code. Returns false for "dev" (nothing sent). Throws OtpSendError when the provider refuses. */
export async function sendLoginCode(phone: string, code: string): Promise<boolean> {
  const provider = otpProviderId();
  if (provider === 'dev') return false;
  const req = buildOtpRequest(provider, phone, code);
  const started = Date.now();
  let status = 0, detail = '';
  try {
    const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : req.body, signal: AbortSignal.timeout(12_000) });
    status = res.status;
    if (!res.ok) detail = (await res.text()).slice(0, 300);
  } catch (e) {
    detail = String(e);
  }
  const ok = status >= 200 && status < 300;
  log[ok ? 'info' : 'error'](ok ? 'otp.sent' : 'otp.failed', { provider, style: provider === 'sms' ? env('SMS_STYLE', 'generic') : undefined, to: maskPhoneForLog(phone), status, ms: Date.now() - started, detail: detail || undefined });
  if (!ok) throw new OtpSendError(`login code not sent (${provider}, HTTP ${status})`);
  return true;
}
