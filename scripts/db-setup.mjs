// `npm run db:setup`: LOCAL ONLY. Deletes the local SQLite database and uploaded files, recreates the
// schema and seeds it. It refuses to run against PostgreSQL, so it can never wipe the production database.
import fs from 'node:fs';
import { at, ensureClient, ensureEnv, isPostgres, loadEnv, prisma, removeDb, tsx } from './lib.mjs';

ensureEnv();
loadEnv();
if (isPostgres()) {
  console.error('✗ db:setup resets the database and only works with local SQLite.\n  DATABASE_URL points to PostgreSQL. For production use: npm run db:migrate');
  process.exit(1);
}
ensureClient();
removeDb('dev.db');
fs.rmSync(at('storage'), { recursive: true, force: true });
prisma('creating the database (prisma db push)', ['db', 'push', '--skip-generate']);
tsx('seeding 3 example businesses', ['prisma/seed.ts']);
