// `npm run db:migrate`: brings the database in DATABASE_URL up to date and saves the category presets.
//   PostgreSQL: applies prisma/postgres/migrations (prisma migrate deploy). Safe to run again.
//   SQLite:     prisma db push (local development has no migration history).
// `npm run db:pg-schema` only rewrites prisma/postgres/schema.prisma from prisma/schema.prisma.
//
// After changing a model in prisma/schema.prisma, create the next PostgreSQL migration with
// DATABASE_URL pointing to a development database (a Neon branch), never to production:
//   npm run db:pg-schema
//   npx prisma migrate dev --schema prisma/postgres/schema.prisma --name describe_the_change
import { ensureClient, ensureEnv, isPostgres, loadEnv, prisma, tsx, writePostgresSchema } from './lib.mjs';

ensureEnv();
loadEnv();
writePostgresSchema();
if (process.argv.includes('--schema-only')) process.exit(0);
ensureClient();
if (isPostgres()) prisma('applying database migrations (prisma migrate deploy)', ['migrate', 'deploy']);
else prisma('updating the local database (prisma db push)', ['db', 'push', '--skip-generate']);
tsx('saving category presets', ['prisma/seed.ts']);
