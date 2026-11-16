// Private launch: the password form shown by middleware.ts while SITE_PASSWORD is set.
// GET shows the form, POST checks the password and sets a cookie for 30 days.
import { rateLimitDb } from '@/lib/ratelimit';
import { log } from '@/lib/log';
import { SITE_COOKIE, SITE_COOKIE_DAYS, sameText, sitePassword, siteToken } from '@/lib/site-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Only local paths, so the form can never be used to send someone to another site. */
const safeNext = (v: string | null) => (v && /^\/(?!\/)[^\\]*$/.test(v) && !v.startsWith('/site-password') ? v : '/');

function page(next: string, error = '', status = 200) {
  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Termini · Së shpejti</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:24px;font:16px/1.5 Geist,system-ui,-apple-system,"Segoe UI",sans-serif;background:#0c0c0d;color:#fff}
main{width:100%;max-width:360px}.mark{display:inline-block;width:12px;height:12px;border-radius:50%;background:#c8f03c;margin-right:8px}
.brand{font-weight:600;letter-spacing:-.02em;margin:0 0 40px}h1{font-size:2rem;line-height:1.1;letter-spacing:-.03em;margin:0 0 10px}p{margin:0 0 28px;color:#a5a5ab}
label{display:block;font-size:.875rem;color:#a5a5ab;margin-bottom:8px}input{width:100%;height:56px;padding:0 16px;border-radius:14px;border:1px solid #2c2c30;background:#151517;color:#fff;font:inherit}
input:focus{outline:2px solid #c8f03c;outline-offset:2px}button{width:100%;height:56px;margin-top:12px;border:0;border-radius:14px;background:#c8f03c;color:#0c0c0d;font:600 1rem/1 inherit;cursor:pointer}
.err{margin:12px 0 0;color:#ff8a7a;font-size:.9375rem}</style></head>
<body><main><p class="brand"><span class="mark"></span>Termini</p><h1>Së shpejti</h1><p>Faqja është ende private. Shkruaj fjalëkalimin për ta parë.</p>
<form method="post" action="/site-password"><input type="hidden" name="next" value="${esc(next)}"><label for="pw">Fjalëkalimi</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}<button type="submit">Hyr</button></form></main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
}

export async function GET(req: Request) {
  const next = safeNext(new URL(req.url).searchParams.get('next'));
  if (!sitePassword()) return Response.redirect(new URL(next, req.url), 307);
  return page(next);
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const next = safeNext(form ? String(form.get('next') || '') : null);
  const expected = sitePassword();
  if (!expected) return Response.redirect(new URL(next, req.url), 303);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean).pop() || 'local';
  if (!(await rateLimitDb(`sitepw:${ip}`, 10, 15 * 60e3))) return page(next, 'Shumë tentime. Provo përsëri pas pak minutash.', 429);
  const given = form ? String(form.get('password') || '') : '';
  if (!sameText(await siteToken(given), await siteToken(expected))) {
    log.warn('site_password.wrong', { ip });
    return page(next, 'Fjalëkalimi nuk është i saktë.', 401);
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: {
      location: next,
      'set-cookie': `${SITE_COOKIE}=${await siteToken()}; Path=/; Max-Age=${SITE_COOKIE_DAYS * 86400}; HttpOnly; SameSite=Lax${secure}`,
      'cache-control': 'no-store',
    },
  });
}
