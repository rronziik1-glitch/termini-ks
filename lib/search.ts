// v6 global search for "Gjej një termin": customers type anything ("berber prishtine", "qethje", "Arti", "dhëmbë")
// and see the matching businesses. Albanian-aware: case and the letters ë / ç do not matter ("prishtine" finds
// "Prishtinë", "cka" finds "çka"), and every word must match somewhere: name, services, city, type, address or text.
import { sq } from './sq';

/** Lower case, no diacritics (ë → e, ç → c), single spaces. */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The search words: at most 6, each at least 2 letters ("te", "ne" and other tiny words are ignored). */
const STOP = new Set(['te', 'ne', 'me', 'per', 'dhe', 'ose', 'ku', 'nje', 'i', 'e', 'ne', 'tek']);
export function searchWords(q: string): string[] {
  return [...new Set(fold(q).split(' ').filter((w) => w.length >= 2 && !STOP.has(w)))].slice(0, 6);
}

export type Searchable = { name: string; city: string; category: string; address: string; description: string; services: { name: string; description: string }[] };

/** 0 = no match. Higher = better: name first, then a service, then the rest. */
export function searchScore(b: Searchable, words: string[]): { score: number; service: string | null } {
  if (!words.length) return { score: 1, service: null };
  const name = fold(b.name);
  const services = b.services.map((s) => ({ name: s.name, text: fold(`${s.name} ${s.description}`) }));
  const category = fold([sq.categories[b.category], sq.categoriesShort[b.category], sq.categoriesFor[b.category], b.category].filter(Boolean).join(' '));
  const rest = fold(`${b.city} ${b.address} ${b.description}`);
  let score = 0;
  let service: string | null = null;
  for (const w of words) {
    const hitName = name.split(' ').some((x) => x.startsWith(w)) ? 6 : name.includes(w) ? 4 : 0;
    const s = services.find((x) => x.text.split(' ').some((y) => y.startsWith(w)) || x.text.includes(w));
    const hitService = s ? 3 : 0;
    const hitCategory = category.split(' ').some((x) => x.startsWith(w)) ? 2 : 0;
    const hitRest = rest.includes(w) ? 1 : 0;
    const best = Math.max(hitName, hitService, hitCategory, hitRest);
    if (!best) return { score: 0, service: null };          // every word must match somewhere
    if (best === hitService && !hitName && s && !service) service = s.name;
    score += best;
  }
  return { score, service };
}
