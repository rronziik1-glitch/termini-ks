// Login for business owners: phone number + 6-digit code. The code is delivered by the provider chosen with
// OTP_PROVIDER (lib/otp.ts): dev = shown on screen and logged, sms, or whatsapp. Sessions are random tokens stored hashed.
import { randomInt } from 'node:crypto';
import type { User } from '@prisma/client';
import { AppError, db } from './db';
import { config, randomId, rateLimit, sha } from './config';
import { log, maskPhoneForLog } from './log';
import { otpProviderId, sendLoginCode } from './otp';
import { normalizePhone } from './phone';
import { sq } from './sq';

export const SESSION_COOKIE = 't_session';
export const SESSION_DAYS = 60;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const codeHash = (phone: string, code: string) => sha(`code:${phone}:${code}`);
const tokenHash = (token: string) => sha(`sess:${token}`);

export async function requestCode(phoneRaw: unknown, ip = 'local'): Promise<{ phone: string; devCode?: string }> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
  if (!rateLimit(`code:${phone}`, 5, 15 * 60e3)) throw new AppError('rate_limited', 429, sq.errors.rate_limited);
  // Audit fix: also limit per IP, so one client cannot trigger SMS to thousands of numbers (SMS cost / pumping).
  if (!rateLimit(`codeip:${ip}`, 20, 3600e3)) throw new AppError('rate_limited', 429, sq.errors.rate_limited);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const row = await db.loginCode.create({ data: { phone, codeHash: codeHash(phone, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60e3) } });
  if (otpProviderId() !== 'dev') {
    // A real provider: the code goes to the phone and is never returned to the browser.
    try { await sendLoginCode(phone, code); }
    catch {
      await db.loginCode.delete({ where: { id: row.id } }).catch(() => undefined);
      throw new AppError('code_not_sent', 502, sq.errors.code_not_sent);
    }
    return { phone };
  }
  const show = config.showLoginCodes();
  if (show) console.log(`[login] kodi për ${phone}: ${code}`);
  else log.warn('otp.not_delivered', { to: maskPhoneForLog(phone), reason: 'OTP_PROVIDER=dev and codes are hidden' });
  return { phone, devCode: show ? code : undefined };
}

export async function verifyCode(phoneRaw: unknown, codeRaw: unknown, name?: string): Promise<{ user: User; token: string }> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new AppError('invalid_phone', 422, sq.errors.invalid_phone);
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  const row = await db.loginCode.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!row) throw new AppError('wrong_code', 422, sq.errors.wrong_code);
  if (row.expiresAt < new Date() || row.attempts >= MAX_ATTEMPTS) throw new AppError('code_expired', 422, sq.errors.code_expired);
  // Audit fix: count the attempt atomically BEFORE comparing. The old read-then-compare let many parallel
  // requests all see attempts=0, so the 5-try limit could be bypassed by sending guesses concurrently.
  const claimed = await db.loginCode.updateMany({ where: { id: row.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (claimed.count === 0) throw new AppError('code_expired', 422, sq.errors.code_expired);
  if (row.codeHash !== codeHash(phone, code)) throw new AppError('wrong_code', 422, sq.errors.wrong_code);
  const consumed = await db.loginCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count === 0) throw new AppError('code_expired', 422, sq.errors.code_expired);

  const isAdmin = config.adminPhones().includes(phone);
  const cleanName = (name || '').trim().slice(0, 60);
  const existing = await db.user.findUnique({ where: { phone } });
  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { lastLoginAt: new Date(), role: isAdmin ? 'admin' : existing.role, name: existing.name || cleanName },
      })
    : await db.user.create({ data: { phone, name: cleanName, role: isAdmin ? 'admin' : 'owner', lastLoginAt: new Date() } });
  const token = await createSession(user.id);
  return { user, token };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomId(40);
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) } });
  return token;
}

export async function userFromToken(token: string | undefined | null) {
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}

export async function destroySession(token: string | undefined | null) {
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
}

export const businessOf = (userId: string) => db.business.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } });
