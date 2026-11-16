// Shared helpers for the setup scripts. Runs the local Prisma and tsx CLIs with plain `node`,
// so nothing depends on npx or on a global install.
//
// Two databases, one data model:
//   SQLite      (DATABASE_URL="file:./dev.db")      local development and the tests   → prisma/schema.prisma
//   PostgreSQL  (DATABASE_URL="postgresql://…")     production (Neon / Supabase)      → prisma/postgres/schema.prisma
// prisma/postgres/schema.prisma is generated from prisma/schema.prisma (scripts/make-postgres-schema.mjs),
// so the models are written once. Which one is used is decided only by DATABASE_URL.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const at = (...p) => path.join(root, ...p);
export const PG_SCHEMA = path.join('prisma', 'postgres', 'schema.prisma');

/** Reads .env into process.env (values that are already set win, as on Vercel). */
export function loadEnv() {
  try { process.loadEnvFile(at('.env')); } catch { /* no .env: use the real environment */ }
}

export const isPostgres = (url = process.env.DATABASE_URL || '') => /^postgres(ql)?:\/\//.test(url);
/** True on Vercel or any CI: never create a .env with development values there. */
export const isHosted = () => !!(process.env.VERCEL || process.env.CI);

export function run(label, args, env = {}) {
  console.log(`\n› ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}

/** Prisma CLI. `pg: true` uses the PostgreSQL schema; DIRECT_URL falls back to DATABASE_URL. */
export function prisma(label, args, env = {}, { pg = isPostgres(env.DATABASE_URL ?? process.env.DATABASE_URL) } = {}) {
  const extra = pg ? { DIRECT_URL: process.env.DIRECT_URL || env.DATABASE_URL || process.env.DATABASE_URL || '' } : {};
  run(label, [at('node_modules', 'prisma', 'build', 'index.js'), ...args, ...(pg ? ['--schema', PG_SCHEMA] : [])], { ...extra, ...env });
}
export const tsx = (label, args, env) => run(label, [at('node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], env);

export function ensureEnv() {
  if (isHosted() || fs.existsSync(at('.env'))) return;
  fs.copyFileSync(at('.env.example'), at('.env'));
  console.log('› created .env from .env.example');
}

/** Text of prisma/postgres/schema.prisma, derived from prisma/schema.prisma. */
export function postgresSchemaText() {
  let s = fs.readFileSync(at('prisma', 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
  const header =
    '// GENERATED from prisma/schema.prisma by scripts/lib.mjs (npm run db:pg-schema). Do not edit: change\n' +
    '// prisma/schema.prisma and run it again. Used when DATABASE_URL is PostgreSQL.\n\n';
  s = s.replace(/generator client \{[^}]*\}/, 'generator client {\n  provider      = "prisma-client-js"\n  // "rhel-openssl-3.0.x" is the engine Vercel\'s servers need.\n  binaryTargets = ["native", "rhel-openssl-3.0.x"]\n}');
  s = s.replace(/datasource db \{[^}]*\}/, 'datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  // Used only by migrations. With Neon/Supabase pooled URLs, put the direct (non-pooled) URL here.\n  directUrl = env("DIRECT_URL")\n}');
  if (!s.includes('provider  = "postgresql"')) throw new Error('could not rewrite the datasource block of prisma/schema.prisma');
  return header + s;
}

export function writePostgresSchema() {
  const file = at(PG_SCHEMA);
  const text = postgresSchemaText();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== text) {
    fs.writeFileSync(file, text);
    console.log(`› wrote ${PG_SCHEMA}`);
  }
}

/** Which database the generated Prisma client in node_modules was built for ("" = not generated yet). */
function clientProvider() {
  try {
    const s = fs.readFileSync(at('node_modules', '.prisma', 'client', 'schema.prisma'), 'utf8');
    return /provider\s*=\s*"postgresql"/.test(s) ? 'postgresql' : 'sqlite';
  } catch { return ''; }
}

/** Makes sure the Prisma client matches the database in DATABASE_URL (regenerates after a switch). */
export function ensureClient(url = process.env.DATABASE_URL || '') {
  const want = isPostgres(url) ? 'postgresql' : 'sqlite';
  const have = fs.existsSync(at('node_modules', '.prisma', 'client', 'index.js')) ? clientProvider() : '';
  if (have === want) return;
  if (want === 'postgresql') writePostgresSchema();
  prisma(`prisma generate (${want})`, ['generate'], { DATABASE_URL: url || 'file:./dev.db' }, { pg: want === 'postgresql' });
}

export function removeDb(name) {
  for (const f of [name, `${name}-journal`]) fs.rmSync(at('prisma', f), { force: true });
}
