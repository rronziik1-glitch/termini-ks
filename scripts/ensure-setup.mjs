// Runs before `npm run dev` and `npm run build`.
//   Local (SQLite):      makes sure .env, the Prisma client and a seeded database exist, so the app
//                        starts with two commands (npm install, npm run dev).
//   Production (Postgres, e.g. the Vercel build): generates the PostgreSQL client, applies the
//                        migrations (prisma migrate deploy) and saves the category presets.
//                        Set SKIP_DB_MIGRATE=1 to build without touching the database.
import fs from 'node:fs';
import { at, ensureClient, ensureEnv, isPostgres, loadEnv, prisma, tsx, writePostgresSchema } from './lib.mjs';

ensureEnv();
loadEnv();
writePostgresSchema();
ensureClient();

if (isPostgres()) {
  if (process.env.SKIP_DB_MIGRATE === '1') {
    console.log('› SKIP_DB_MIGRATE=1: database migrations skipped');
  } else {
    prisma('applying database migrations (prisma migrate deploy)', ['migrate', 'deploy']);
    tsx('saving category presets', ['prisma/seed.ts']);
  }
} else if (!fs.existsSync(at('prisma', 'dev.db'))) {
  prisma('creating the database (prisma db push)', ['db', 'push', '--skip-generate']);
  tsx('seeding 3 example businesses', ['prisma/seed.ts']);
}
