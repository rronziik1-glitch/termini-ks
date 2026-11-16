import { createHash, randomBytes } from 'node:crypto';

const env = (k: string, d = '') => process.env[k] ?? d;

export const config = {
  appUrl: () => env('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  publicLinkHost: () => env('PUBLIC_LINK_HOST'),
  secret: () => {
    const s = env('APP_SECRET', 'dev-secret-change-me');
    // Audit fix: never run production with the public default secret (it salts login codes, sessions and IP hashes).
    if (process.env.NODE_ENV === 'production' && (s === 'dev-secret-change-me' || s.length < 24)) {
      throw new Error('APP_SECRET is missing or too short. Set a random value of 32+ characters in .env before running in production.');
    }
    return s;
  },
  // Audit fix: .env (copied from .env.example) has SHOW_LOGIN_CODES="1", which used to return every login code in the
  // API response in production too, so anyone could log in as anyone (incl. the admin). In production the code is
  // shown only with the explicit, loudly named DEMO_SHOW_CODES_IN_PRODUCTION=1 (for a private demo, never live).
  showLoginCodes: () =>
    process.env.NODE_ENV === 'production'
      ? env('DEMO_SHOW_CODES_IN_PRODUCTION') === '1'
      : env('SHOW_LOGIN_CODES', '1') === '1',
  adminPhones: () => env('ADMIN_PHONES').split(',').map((s) => s.trim()).filter(Boolean),
  supportWhatsapp: () => env('SUPPORT_WHATSAPP', '38349000000').replace(/\D/g, ''),
  supportName: () => env('SUPPORT_NAME', 'Termini'),
  anthropicKey: () => env('ANTHROPIC_API_KEY'),
  modelFill: () => env('AI_MODEL_FILL', 'claude-haiku-5-5'),
  modelRetry: () => env('AI_MODEL_RETRY', 'claude-sonnet-5-5'),
  payseraProjectId: () => env('PAYSERA_PROJECT_ID'),
  payseraPassword: () => env('PAYSERA_SIGN_PASSWORD'),
  payseraTest: () => env('PAYSERA_TEST', '1') === '1',
  /** Paysera's public key (PEM). "\n" written as two characters is turned into real line breaks. */
  payseraPublicKey: () => env('PAYSERA_PUBLIC_KEY').replace(/\\n/g, '\n'),
  payseraPayUrl: () => env('PAYSERA_PAY_URL', 'https://www.paysera.com/pay/'),
  /** Language of the Paysera payment page (three letters, e.g. ENG, ALB is not offered by Paysera). */
  payseraLang: () => env('PAYSERA_LANG', 'ENG'),
  /** Domain whose subdomains are Faqja Gati pages (emri.faqjagati.com). Empty = pages live at APP_URL/p/emri. */
  pagesDomain: () => env('PAGES_DOMAIN').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
  bank: () => ({ iban: env('BANK_IBAN', 'XK05 0000 0000 0000 0000'), name: env('BANK_NAME', 'Banka'), holder: env('BANK_HOLDER', '') }),
  pagePriceCents: () => Number(env('PAGE_PRICE_CENTS', '10000')) || 10000,
  domainPriceCents: () => 1500,
  reminderChannel: () => env('REMINDER_CHANNEL', 'link'),
  /** Slows the local filler down a little so the four progress stages can be seen. Tests set it to 0. */
  stageDelayMs: () => Number(env('FG_STAGE_DELAY_MS', '900')),
};

export const sha = (s: string) => createHash('sha256').update(s + '|' + config.secret()).digest('hex');
export const ipHash = (ip: string) => sha('ip:' + ip).slice(0, 32);

const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Unguessable id for booking tokens and preview URLs. */
export function randomId(len = 20): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHA[bytes[i] % ALPHA.length];
  return out;
}

/** Booking link as shown to people: termini.app/slug in production, host/b/slug locally. */
export function displayLink(slug: string, origin?: string) {
  const host = config.publicLinkHost();
  if (host) return { prefix: host + '/', slug };
  return { prefix: (origin || config.appUrl()).replace(/^https?:\/\//, '') + '/b/', slug };
}
export const bookingUrl = (slug: string, origin?: string) => `${origin || config.appUrl()}/b/${slug}`;
export const bookingTokenUrl = (slug: string, token: string, origin?: string) => `${bookingUrl(slug, origin)}/t/${token}`;
/** Public address of a published page: emri.<PAGES_DOMAIN> when the domain is set up, else APP_URL/p/emri. */
export const livePageUrl = (subdomain: string, origin?: string) =>
  config.pagesDomain() ? `https://${subdomain}.${config.pagesDomain()}` : `${origin || config.appUrl()}/p/${subdomain}`;
/** What the payment screen shows after the name: ".faqjagati.com". */
export const pagesHostSuffix = () => '.' + (config.pagesDomain() || 'faqjagati.com');

/* ---- in-memory rate limiter (one process; move to Redis/Upstash with several instances) ---- */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return false; }
  list.push(now);
  hits.set(key, list);
  return true;
}
