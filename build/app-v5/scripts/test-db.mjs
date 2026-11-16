// Runs before the tests: a fresh, empty SQLite database at prisma/test.db (never the dev database).
import { ensureClient, ensureEnv, prisma, removeDb } from './lib.mjs';

ensureEnv();
ensureClient();
removeDb('test.db');
prisma('creating the test database', ['db', 'push', '--skip-generate'], { DATABASE_URL: 'file:./test.db' });
