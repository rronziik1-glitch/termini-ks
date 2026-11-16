// Runs after `npm install`: generates the Prisma client for the database in DATABASE_URL
// (PostgreSQL on Vercel, SQLite on your computer). Also refreshes prisma/postgres/schema.prisma.
import { isPostgres, loadEnv, prisma, writePostgresSchema } from './lib.mjs';

loadEnv();
writePostgresSchema();
const pg = isPostgres();
prisma(`prisma generate (${pg ? 'postgresql' : 'sqlite'})`, ['generate'], { DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db' }, { pg });
