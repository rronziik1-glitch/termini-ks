import { config } from './config';
// A very small router for /api/*. Routes are registered in lib/api/*.ts with the paths from
// fable/01-product-design.md §8 and dispatched by app/api/[...path]/route.ts.
// Errors always look like { error: { code, message } } with an Albanian message ready to show.
import type { Business, User } from '@prisma/client';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, businessOf, isSuperAdmin, userFromToken } from './auth';
import { ADMIN_COOKIE, adminUnlocked } from './adminAuth';
import { AppError } from './db';
import { classifyHost } from './site-lock';
import { sq } from './sq';

export type Auth = 'public' | 'user' | 'owner' | 'admin';
export type Ctx = {
  req: Request;
  url: URL;
  query: URLSearchParams;
  params: Record<string, string>;
  origin: string;
  ip: string;
  user: User | null;
  business: Business | null;
  /** Logged-in user; the router guarantees it for 'user', 'owner' and 'admin' routes. */
  me: User;
  /** The owner's business; guaranteed for 'owner' routes. */
  biz: Business;
  body: <T = Record<string, unknown>>() => Promise<T>;
};
type Handler = (c: Ctx) => Promise<Response | object | null | void>;
type Route = { method: string; parts: string[]; auth: Auth; handler: Handler };

const g = globalThis as unknown as { __routes?: Map<string, Route> };
const routes = (g.__routes ??= new Map<string, Route>());

export function route(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, auth: Auth, handler: Handler) {
  routes.set(`${method} ${path}`, { method, parts: path.split('/').filter(Boolean), auth, handler });
}

function match(method: string, parts: string[]): { route: Route; params: Record<string, string> } | null {
  let best: { route: Route; params: Record<string, string>; score: number } | null = null;
  for (const r of routes.values()) {
    if (r.method !== method || r.parts.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true, score = 0;
    for (let i = 0; i < parts.length; i++) {
      if (r.parts[i].startsWith(':')) { try { params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]); } catch { ok = false; break; } }   // a broken % sequence is simply "not found"
      else if (r.parts[i] === parts[i]) score++;
      else { ok = false; break; }
    }
    if (ok && (!best || score > best.score)) best = { route: r, params, score };   // literal segments win over :params
  }
  return best;
}

export const errorResponse = (e: unknown) => {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, ...(e.extra || {}) } }, { status: e.status });
  console.error('[api]', e);
  return NextResponse.json({ error: { code: 'server_error', message: sq.common.failed } }, { status: 500 });
};

export function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function requestOrigin(req: Request): string {
  // Production: never trust Host / X-Forwarded-Host (links, QR codes and Paysera URLs are built from this).
  if (process.env.NODE_ENV === 'production') return config.appUrl();
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

/** v4 audit (cross-site request forgery): a browser always sends `Origin` with a cross-site POST/PUT/PATCH/DELETE.
 *  Customer pages live on sibling addresses (emri.<domain>), which browsers treat as the SAME site, so the
 *  SameSite cookie flag alone does not stop them. A write is accepted only from our own origin; requests
 *  without the header (Paysera's server, scripts, the smoke test) are not browsers and carry no victim's cookie. */
export function sameOriginWrite(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
  const origin = req.headers.get('origin');
  if (!origin) return true;
  let from: string;
  try { from = new URL(origin).host.toLowerCase(); } catch { return false; }       // "null" (sandboxed page, redirect)
  const own = new Set<string>();
  try { own.add(new URL(config.appUrl()).host.toLowerCase()); } catch { /* bad APP_URL is reported at startup */ }
  const host = (req.headers.get('host') || '').toLowerCase();
  // The request's own host counts too (local development, Vercel preview addresses), except page addresses.
  if (host && classifyHost(host).kind === 'app') own.add(host);
  return own.has(from);
}

export async function dispatch(req: Request, parts: string[]): Promise<Response> {
  try {
    const m = match(req.method, parts);
    if (!m) return NextResponse.json({ error: { code: 'not_found', message: sq.errors.not_found } }, { status: 404 });
    const url = new URL(req.url);
    if (!sameOriginWrite(req)) throw new AppError('forbidden', 403, sq.errors.forbidden);
    const sessionToken = cookieValue(req, SESSION_COOKIE);
    const user = await userFromToken(sessionToken);
    const business = user ? await businessOf(user.id) : null;
    if (m.route.auth !== 'public' && !user) throw new AppError('unauthorized', 401, sq.errors.unauthorized);
    if (m.route.auth === 'owner' && !business) throw new AppError('forbidden', 403, sq.errors.forbidden);
    if (m.route.auth === 'admin' && !isSuperAdmin(user)) throw new AppError('forbidden', 403, sq.errors.forbidden);
    // Second lock: admin routes also need the admin password unlock for this session.
    if (m.route.auth === 'admin' && !adminUnlocked(sessionToken, cookieValue(req, ADMIN_COOKIE))) throw new AppError('admin_locked', 403, sq.admin.locked);
    const c: Ctx = {
      req, url, query: url.searchParams, params: m.params, origin: requestOrigin(req),
      // Audit fix: the LEFTMOST X-Forwarded-For entry is whatever the client typed, so rate limits keyed on it could be
      // bypassed by sending a random header per request. The rightmost entry is the one added by our own proxy.
      ip: (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean).pop() || 'local',
      user, business, me: user as User, biz: business as Business,
      body: async <T,>() => {
        try { return (await req.json()) as T; } catch { throw new AppError('bad_request', 400, sq.errors.bad_request); }
      },
    };
    const out = await m.route.handler(c);
    if (out instanceof Response) return out;
    return NextResponse.json(out ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
