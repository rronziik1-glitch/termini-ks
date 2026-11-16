// Private launch password (SITE_PASSWORD) and host routing helpers.
// Used by middleware.ts (edge runtime) and app/site-password/route.ts, so only Web APIs here: no node: imports.
export const SITE_COOKIE = 't_site';
export const SITE_COOKIE_DAYS = 30;
/** Paths that must work without the password: Paysera's server calls the callback, the form unlocks the site. */
export const SITE_OPEN_PATHS = ['/api/payments/paysera/callback', '/site-password'];

export const sitePassword = () => (process.env.SITE_PASSWORD || '').trim();

/** The cookie value for the current password. Changing SITE_PASSWORD or APP_SECRET logs everyone out. */
export async function siteToken(password = sitePassword()): Promise<string> {
  const data = new TextEncoder().encode(`site:${password}:${process.env.APP_SECRET || 'dev-secret-change-me'}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare. */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const bare = (host: string) => host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
export const appHost = () => { try { return bare(new URL(process.env.APP_URL || 'http://localhost:3000').host); } catch { return 'localhost'; } };
/** Domain whose subdomains are Faqja Gati pages: PAGES_DOMAIN, or the app's own domain. */
export const pagesDomain = () => bare((process.env.PAGES_DOMAIN || '').trim()) || appHost();

const RESERVED = new Set(['www', 'app', 'api', 'admin', 'mail', 'ftp', 'staging', 'dev', 'test']);

export type HostKind =
  | { kind: 'app' }                       // the main site
  | { kind: 'www' }                       // www.<domain> → redirect to the main site
  | { kind: 'page'; slug: string }        // <slug>.<pages domain> or a customer's own domain → a published page
  ;

/** Decides what a request host means. `slug` is the subdomain, or the whole host for a customer's own domain. */
export function classifyHost(hostHeader: string | null | undefined): HostKind {
  const host = bare(hostHeader || '');
  const app = appHost();
  const pages = pagesDomain();
  if (!host || host === app) return { kind: 'app' };
  if (host === pages) return { kind: process.env.PAGES_DOMAIN ? 'www' : 'app' };   // faqjagati.com itself → main site
  if (host.endsWith('.' + pages)) {
    const sub = host.slice(0, -(pages.length + 1));
    if (RESERVED.has(sub)) return { kind: 'www' };
    if (/^[a-z0-9][a-z0-9-]{0,62}$/.test(sub)) return { kind: 'page', slug: sub };
    return { kind: 'app' };
  }
  if (host.endsWith('.' + app) && RESERVED.has(host.slice(0, -(app.length + 1)))) return { kind: 'www' };
  // Hosts that are never a customer's domain: local names, IP addresses, Vercel's own addresses.
  if (host === 'localhost' || host.endsWith('.localhost') || /^[\d.]+$/.test(host) || host.endsWith('.vercel.app')) return { kind: 'app' };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return { kind: 'page', slug: host };
  return { kind: 'app' };
}
