// Runs before every request (edge runtime). Two jobs:
//  1. Private launch: when SITE_PASSWORD is set, everything asks for the password first
//     (except the Paysera callback, which Paysera's server must reach, and the password form itself).
//  2. Faqja Gati addresses: <name>.<domain> (and a customer's own domain) show the published page.
//     The same page always stays reachable at /p/<name>.
import { NextResponse, type NextRequest } from 'next/server';
import { SITE_COOKIE, SITE_OPEN_PATHS, classifyHost, sameText, sitePassword, siteToken } from './lib/site-lock';

export const config = {
  // Everything except Next's own static files.
  matcher: ['/((?!_next/static|_next/image).*)'],
};

const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // --- 1. private launch password ------------------------------------------------
  // v4 audit: Paysera must open the home page once to see the ownership code (PAYSERA_VERIFY_CODE). Removing the
  // whole password for that would also open the login and the test payments, so only the home page is let through,
  // and only while the code is set.
  const payseraCheck = !!(process.env.PAYSERA_VERIFY_CODE || '').trim() && pathname === '/' && (req.method === 'GET' || req.method === 'HEAD');
  if (sitePassword() && !payseraCheck && !SITE_OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const cookie = req.cookies.get(SITE_COOKIE)?.value || '';
    if (!cookie || !sameText(cookie, await siteToken())) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: { code: 'site_locked', message: 'Faqja është ende private. Shkruaj fjalëkalimin.' } }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/site-password';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      const res = NextResponse.redirect(url, 307);
      res.headers.set('x-robots-tag', 'noindex, nofollow');
      return res;
    }
  }

  // --- 2. page hosts -------------------------------------------------------------
  const host = classifyHost(req.headers.get('host') || req.nextUrl.host);
  if (host.kind === 'www') return NextResponse.redirect(appUrl() + pathname + search, 308);
  if (host.kind === 'page') {
    if (pathname === '/' || pathname === '') {
      const url = req.nextUrl.clone();
      url.pathname = `/p/${host.slug}`;
      return NextResponse.rewrite(url);
    }
    // The page's own photos and the shared template files are served from the same host.
    const allowed = pathname.startsWith('/p/') || pathname.startsWith('/fg/') || pathname === '/site-password' || /^\/(icon[^/]*|favicon\.ico|robots\.txt)$/.test(pathname);
    if (!allowed) return NextResponse.redirect(appUrl() + pathname + search, 307);
  }
  return NextResponse.next();
}
