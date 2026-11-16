// Runs shot.mjs for every template: phone (375), desktop (1280) and the watermarked preview.
//   node fable/templates/tools/shot-all.mjs [outDir=fable/_shots] [mode=all|phone|desktop|preview]
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = process.argv[2] || join(root, '..', '_shots');
const mode = process.argv[3] || 'all';
mkdirSync(out, { recursive: true });
const templates = JSON.parse(readFileSync(join(root, 'schema.json'), 'utf8')).properties.meta.properties.template.enum;

const jobs = [];
for (const t of templates) {
  const page = join(root, t, 'index.html');
  if (mode === 'all' || mode === 'phone') jobs.push([t + ' 375', [page, join(out, `${t}-375.png`), '375', '812', '2600']]);
  if (mode === 'all' || mode === 'desktop') jobs.push([t + ' 1280', [page, join(out, `${t}-1280.png`), '1280', '800', '9000']]);
  if (mode === 'all' || mode === 'preview') jobs.push([t + ' preview', [page + '?preview=1', join(out, `${t}-preview.png`), '375', '812', '1700']]);
}
let failed = false;
for (const [label, args] of jobs) {
  const r = spawnSync(process.execPath, [join(here, 'shot.mjs'), ...args], { encoding: 'utf8' });
  console.log(`== ${label}\n${(r.stdout || '').trim()}${r.stderr ? '\n' + r.stderr.trim() : ''}`);
  if (r.status) failed = true;
}
process.exit(failed ? 1 : 0);
