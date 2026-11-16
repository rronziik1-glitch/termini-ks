// Runs before `npm run dev` and `npm run build`: makes sure .env, the Prisma client and a seeded
// SQLite database exist, so the app starts with two commands (npm install, npm run dev).
import fs from 'node:fs';
import { at, ensureClient, ensureEnv, prisma, tsx } from './lib.mjs';

ensureEnv();
ensureClient();
if (!fs.existsSync(at('prisma', 'dev.db'))) {
  prisma('creating the database (prisma db push)', ['db', 'push', '--skip-generate']);
  tsx('seeding 3 example businesses', ['prisma/seed.ts']);
}
