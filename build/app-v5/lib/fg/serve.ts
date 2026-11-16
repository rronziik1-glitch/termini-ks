// Responses for the raw Faqja Gati HTML and photos (route handlers under app/faqja and app/p).
// Previews: no-store, noindex, same-origin framing only (01-product-design.md §6.3).
import { AppError } from '../db';
import { sq } from '../sq';
import { readStored } from './images';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** v4 audit: generated pages hold text typed by strangers and are served from the app's own address (/p/…).
 *  The policy allows only our own script file, our styles, Google Fonts, images and the Google map frame, so even
 *  if some text ever slipped through as markup it could not run a script or send data anywhere. */
export function pageCsp(kind: 'preview' | 'live'): string {
  return [
    "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https:", "media-src 'self' https:",
    'frame-src https://www.google.com https://maps.google.com', "connect-src 'none'", "object-src 'none'",
    "base-uri 'none'", "form-action 'none'", `frame-ancestors ${kind === 'preview' ? "'self'" : "'none'"}`,
  ].join('; ');
}

export function htmlResponse(html: string, kind: 'preview' | 'live') {
  const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': pageCsp(kind) };
  if (kind === 'preview') {
    headers['cache-control'] = 'no-store';
    headers['x-frame-options'] = 'SAMEORIGIN';
    headers['x-robots-tag'] = 'noindex, nofollow';
  } else {
    headers['cache-control'] = 'public, max-age=60';
  }
  return new Response(html, { headers });
}

/** Small Albanian error page in the design system's colours (used inside the preview frame too). */
export function messagePage(status: number, title: string, text: string, link?: { href: string; label: string }) {
  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 Geist,system-ui,sans-serif;background:#f6f6f3;color:#0c0c0d;padding:24px;box-sizing:border-box;text-align:center}
h1{font-size:1.5rem;letter-spacing:-.02em;margin:0 0 8px}p{margin:0 0 20px;color:#55555a}a{display:inline-block;padding:14px 22px;border-radius:999px;background:#0c0c0d;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(text)}</p>${link ? `<a href="${esc(link.href)}" target="_top">${esc(link.label)}</a>` : ''}</main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

export const notFoundPage = () => messagePage(404, sq.fg.notFoundTitle, sq.fg.notFoundText, { href: '/faqja', label: sq.fg.start });

export async function imageResponse(key: string | null, cache: 'private' | 'public') {
  const data = key ? await readStored(key) : null;
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': cache === 'public' ? 'public, max-age=86400' : 'private, no-store' },
  });
}

/** Turns an AppError from the page library into an HTML message page. */
export function errorPage(e: unknown) {
  if (e instanceof AppError) {
    if (e.code === 'preview_expired') return messagePage(410, sq.fg.expiredTitle, sq.fg.expiredText);
    if (e.status === 404) return notFoundPage();
    return messagePage(e.status, sq.fg.notFoundTitle, e.message);
  }
  console.error('[faqja-gati]', e);
  return messagePage(500, sq.common.failed, sq.fg.failedFinal);
}
