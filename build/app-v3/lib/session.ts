// Request-bound helpers (cookies, host). Only import from server components and route handlers.
import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE, businessOf, userFromToken } from './auth';
import { config } from './config';

export async function getSession() {
  const jar = await cookies();
  const user = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  const business = user ? await businessOf(user.id) : null;
  return { user, business };
}

/** Origin of the current request, e.g. http://localhost:3000 (falls back to APP_URL). */
export async function getOrigin(): Promise<string> {
  if (process.env.NODE_ENV === 'production') return config.appUrl();
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return config.appUrl();
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
