// Shared helpers for the setup scripts. Runs the local Prisma and tsx CLIs with plain `node`,
// so nothing depends on npx or on a global install.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const at = (...p) => path.join(root, ...p);

export function run(label, args, env = {}) {
  console.log(`\n› ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}

export const prisma = (label, args, env) => run(label, [at('node_modules', 'prisma', 'build', 'index.js'), ...args], env);
export const tsx = (label, args, env) => run(label, [at('node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], env);

export function ensureEnv() {
  if (!fs.existsSync(at('.env'))) {
    fs.copyFileSync(at('.env.example'), at('.env'));
    console.log('› created .env from .env.example');
  }
}

export function ensureClient() {
  if (!fs.existsSync(at('node_modules', '.prisma', 'client', 'index.js'))) prisma('prisma generate', ['generate']);
}

export function removeDb(name) {
  for (const f of [name, `${name}-journal`]) fs.rmSync(at('prisma', f), { force: true });
}
