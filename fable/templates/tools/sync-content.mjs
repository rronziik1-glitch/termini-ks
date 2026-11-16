// Copies each template's content.json into content.js (window.FG_CONTENT = …) so the
// demos also open by double-click (file://), where fetch('content.json') is blocked.
// Also checks every content.json against the required fields of schema.json.
// Run from anywhere:  node fable/templates/tools/sync-content.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schema.json'), 'utf8'));
const templates = schema.properties.meta.properties.template.enum;

// Small validator for the subset of JSON Schema used in schema.json.
function check(node, sch, path, errors) {
  if (sch.$ref) sch = schema.$defs[sch.$ref.split('/').pop()];
  const types = [].concat(sch.type || []);
  const actual = node === null ? 'null' : Array.isArray(node) ? 'array' : Number.isInteger(node) ? 'integer' : typeof node;
  if (types.length && !types.includes(actual) && !(actual === 'integer' && types.includes('number'))) {
    errors.push(`${path}: expected ${types.join('|')}, got ${actual}`); return;
  }
  if (sch.enum && !sch.enum.includes(node)) errors.push(`${path}: "${node}" not in enum`);
  if (sch.pattern && typeof node === 'string' && !new RegExp(sch.pattern).test(node)) errors.push(`${path}: "${node}" does not match ${sch.pattern}`);
  if (actual === 'array') {
    if (sch.maxItems && node.length > sch.maxItems) errors.push(`${path}: more than ${sch.maxItems} items`);
    if (sch.minItems && node.length < sch.minItems) errors.push(`${path}: fewer than ${sch.minItems} items`);
    node.forEach((v, i) => check(v, sch.items || {}, `${path}[${i}]`, errors));
  }
  if (actual === 'object') {
    for (const r of sch.required || []) if (!(r in node)) errors.push(`${path}.${r}: required`);
    for (const [k, v] of Object.entries(node)) {
      const sub = sch.properties && sch.properties[k];
      if (!sub) { if (sch.additionalProperties === false) errors.push(`${path}.${k}: unknown field`); continue; }
      check(v, sub, `${path}.${k}`, errors);
    }
  }
}

let failed = false;
for (const name of readdirSync(root)) {
  const file = join(root, name, 'content.json');
  if (!existsSync(file)) continue;
  const content = JSON.parse(readFileSync(file, 'utf8'));
  const errors = [];
  check(content, schema, 'content', errors);
  if (!templates.includes(name)) errors.push(`folder "${name}" is not a template id in schema.json`);
  if (content.meta && content.meta.template !== name) errors.push(`meta.template is "${content.meta.template}", folder is "${name}"`);
  writeFileSync(join(root, name, 'content.js'),
    '/* generated from content.json by tools/sync-content.mjs; do not edit */\nwindow.FG_CONTENT = ' + JSON.stringify(content, null, 2) + ';\n');
  if (errors.length) { failed = true; console.log(`✗ ${name}\n  ` + errors.join('\n  ')); }
  else console.log(`✓ ${name}`);
}
process.exit(failed ? 1 : 0);
