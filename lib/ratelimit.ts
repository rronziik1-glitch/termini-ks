// Rate limits kept in the database (table RateHit), so they hold across every server instance.
// The in-memory limiter in lib/config.ts only counts inside one instance; on Vercel several instances run
// at once and each new one starts from zero, so it must not be the only guard for anything that costs
// money (SMS) or protects a login.
import { sha } from './config';
import { db, lockKey } from './db';

const DAY = 24 * 3600e3;
let calls = 0;

/** Counts one action for `key`. Returns false (and counts nothing) when `max` actions already happened
 *  inside the window. The key is stored hashed, so no phone number or IP address ends up in the table. */
export async function rateLimitDb(key: string, max: number, windowMs: number): Promise<boolean> {
  const hashed = sha('rl:' + key).slice(0, 40);
  const since = new Date(Date.now() - windowMs);
  const ok = await db.$transaction(async (tx) => {
    await lockKey(tx, 'rl:' + hashed);                      // PostgreSQL: two instances cannot both pass the count
    const n = await tx.rateHit.count({ where: { key: hashed, createdAt: { gt: since } } });
    if (n >= max) return false;
    await tx.rateHit.create({ data: { key: hashed } });
    return true;
  });
  // Housekeeping: now and then delete rows older than the longest window (one day).
  if (++calls % 50 === 0) await db.rateHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - DAY - 3600e3) } } }).catch(() => undefined);
  return ok;
}

/** How many actions are counted for `key` inside the window (does not count a new one). */
export async function rateCount(key: string, windowMs: number): Promise<number> {
  const hashed = sha('rl:' + key).slice(0, 40);
  return db.rateHit.count({ where: { key: hashed, createdAt: { gt: new Date(Date.now() - windowMs) } } });
}
