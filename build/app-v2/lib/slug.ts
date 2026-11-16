// Slugs (01-product-design.md §7.4): a–z 0–9 -, 3–40 characters, ë → e, ç → c.

export const RESERVED = new Set([
  'app', 'admin', 'api', 'b', 'p', 'gjej', 'faqja', 'hyr', 'regjistrohu', 'kushtet', 'privatesia',
  'ndihme', 'static', '_next', 't', 'fillo', 'fg',
]);

export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/ë/g, 'e').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export const isValidSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 40 && !RESERVED.has(s);

/** First free slug: name, then name-city, then name-2, name-3… */
export async function freeSlug(name: string, city: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  let base = slugify(name);
  if (base.length < 3) base = (base + '-biznes').replace(/^-/, '');
  const tries = [base, slugify(`${base} ${city}`)].filter((s, i, a) => s && a.indexOf(s) === i);
  for (const s of tries) if (isValidSlug(s) && !(await taken(s))) return s;
  for (let n = 2; n < 500; n++) {
    const s = `${base.slice(0, 36)}-${n}`;
    if (isValidSlug(s) && !(await taken(s))) return s;
  }
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`;
}
