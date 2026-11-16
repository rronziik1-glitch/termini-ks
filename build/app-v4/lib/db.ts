import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const db = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.__prisma = db;

/** True when DATABASE_URL is PostgreSQL (production). SQLite is used for local development and the tests. */
export const isPostgres = () => /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '');
/** Text search that ignores upper/lower case on both databases (SQLite's LIKE already does; Postgres needs the mode). */
export const containsText = (q: string) => ({ contains: q, ...(isPostgres() ? { mode: 'insensitive' } : {}) }) as { contains: string };

/** Error with an Albanian message that is safe to show to the user. */
export class AppError extends Error {
  constructor(public code: string, public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

/** Inside a transaction: makes every other transaction that locks the same key wait until this one ends.
 *  PostgreSQL only (several server instances); on SQLite writes are already one at a time. */
export async function lockKey(tx: { $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown> }, key: string) {
  if (isPostgres()) await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', key);
}

/** Run tasks with the same key one after another (in-process guard next to the DB transaction). */
const chains = new Map<string, Promise<unknown>>();
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}
