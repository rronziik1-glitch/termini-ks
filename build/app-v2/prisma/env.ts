// Imported first by the seed: loads .env before the Prisma client is created.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env yet: the defaults below apply */
}
process.env.DATABASE_URL ||= 'file:./dev.db';
process.env.FG_STAGE_DELAY_MS = '0';   // no artificial progress delay while seeding
