// `npm run env:check`: checks the settings in .env as if the app were starting in production,
// without starting it. Prints what is missing and what is only a warning.
//   npm run env:check            checks .env on this computer
//   npm run env:check -- vercel  same rules as on Vercel (cloud storage and PostgreSQL required)
import { at, loadEnv, run } from './lib.mjs';

loadEnv();
const asVercel = process.argv.includes('vercel');
run('checking the environment for production', [
  at('node_modules', 'tsx', 'dist', 'cli.mjs'), '-e',
  `import('./lib/env-check.ts').then(({ checkEnv }) => {
     const r = checkEnv({ ...process.env, NODE_ENV: 'production' });
     for (const w of r.warnings) console.log('  warning: ' + w);
     for (const e of r.errors) console.log('  MISSING: ' + e);
     console.log(r.errors.length ? '\\n✗ ' + r.errors.length + ' thing(s) to fix before going online.' : '\\n✓ Ready: nothing required is missing.');
     process.exit(r.errors.length ? 1 : 0);
   })`,
], asVercel ? { VERCEL: '1' } : {});
