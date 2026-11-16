// `npm run db:setup`: deletes the local database and uploaded files, recreates the schema and seeds it.
import fs from 'node:fs';
import { at, ensureClient, ensureEnv, prisma, removeDb, tsx } from './lib.mjs';

ensureEnv();
ensureClient();
removeDb('dev.db');
fs.rmSync(at('storage'), { recursive: true, force: true });
prisma('creating the database (prisma db push)', ['db', 'push', '--skip-generate']);
tsx('seeding 3 example businesses', ['prisma/seed.ts']);
