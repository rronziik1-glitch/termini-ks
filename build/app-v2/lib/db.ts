import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const db = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.__prisma = db;

/** Error with an Albanian message that is safe to show to the user. */
export class AppError extends Error {
  constructor(public code: string, public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
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
