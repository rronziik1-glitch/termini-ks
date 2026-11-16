// Second lock for the admin panel. Being logged in with the admin phone (SMS code) is not enough:
// the admin must also type the admin password, which unlocks /admin for ADMIN_UNLOCK_HOURS on this session only.
// The password is never stored, only an scrypt hash in ADMIN_PASSWORD_HASH (make it with: npm run admin:password).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { rateLimit, sha } from './config';

export const ADMIN_COOKIE = 't_admin';
export const ADMIN_UNLOCK_HOURS = 8;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function checkPassword(password: string, stored: string): boolean {
  const [kind, salt, hex] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hex) return false;
  const want = Buffer.from(hex, 'hex');
  const got = scryptSync(password, salt, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

const storedHash = () => (process.env.ADMIN_PASSWORD_HASH || '').trim();

/** True when an admin password is set up. In production the admin panel stays closed without one. */
export const adminPasswordRequired = () => !!storedHash() || process.env.NODE_ENV === 'production';

/** Checks the password (max 5 tries per 15 min per IP, 20 per hour overall) and returns the cookie value to set. */
export function unlockAdmin(sessionToken: string, password: string, ip: string): { ok: true; cookie: string } | { ok: false; reason: 'rate_limited' | 'wrong' | 'not_set' } {
  if (!rateLimit(`adminpw:${ip}`, 5, 15 * 60e3) || !rateLimit('adminpw:all', 20, 3600e3)) return { ok: false, reason: 'rate_limited' };
  const stored = storedHash();
  if (!stored) return { ok: false, reason: 'not_set' };
  if (!checkPassword(String(password || ''), stored)) return { ok: false, reason: 'wrong' };
  const exp = Date.now() + ADMIN_UNLOCK_HOURS * 3600e3;
  return { ok: true, cookie: `${exp}.${sha(`admin:${sessionToken}:${exp}`)}` };
}

/** The unlock cookie is tied to this login session, so it is useless if copied on its own. */
export function adminUnlocked(sessionToken: string | undefined, cookie: string | undefined): boolean {
  if (!adminPasswordRequired()) return true;          // dev without a password set: demo stays easy
  if (!sessionToken || !cookie) return false;
  const [expRaw, sig] = cookie.split('.');
  const exp = Number(expRaw);
  if (!exp || exp < Date.now() || !sig) return false;
  const want = sha(`admin:${sessionToken}:${exp}`);
  return want.length === sig.length && timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
