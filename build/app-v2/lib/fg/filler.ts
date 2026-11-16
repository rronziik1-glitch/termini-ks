// Deterministic local filler: builds the page content from the form alone, with no AI and no network.
// Used when ANTHROPIC_API_KEY is not set and as the fallback when the model output fails validation twice.
// It only restates what the owner wrote (prices, hours, address, phone); nothing is invented.
import { displayPhone, normalizePhone, waDigits } from '../phone';
import { pad2 } from '../time';
import type { Content, ServiceItem, Template } from './schema';

export type FillInput = {
  template: Template | 'auto';
  name: string;
  city: string;
  text: string;
  oldSiteText?: string;
  photoCount: number;
  contactPhone?: string;        // E.164, from the form
  bookingUrl?: string;          // Termini link when the business has one
  revisionNote?: string;
  previous?: Content | null;
};

type Defaults = { category: string; heroTitle: string; servicesTitle: string; aboutTitle: string; locationTitle: string; galleryTitle: string; bookingLabel: string };
export const TEMPLATE_DEFAULTS: Record<Template, Defaults> = {
  berber: { category: 'Berber', heroTitle: 'Qethje pa pritje', servicesTitle: 'Shërbimet', aboutTitle: 'Rreth nesh', locationTitle: 'Lokacioni dhe orari', galleryTitle: 'Galeria', bookingLabel: 'Rezervo termin' },
  'klinike-dentare': { category: 'Klinikë dentare', heroTitle: 'Kujdes për buzëqeshjen tënde', servicesTitle: 'Shërbimet', aboutTitle: 'Rreth klinikës', locationTitle: 'Ku ndodhemi', galleryTitle: 'Klinika', bookingLabel: 'Rezervo termin' },
  'restorant-kafe': { category: 'Restorant', heroTitle: 'Ulu dhe shijo', servicesTitle: 'Menyja', aboutTitle: 'Rreth nesh', locationTitle: 'Ku ndodhemi', galleryTitle: 'Galeria', bookingLabel: 'Rezervo tavolinë' },
  bujtine: { category: 'Bujtinë', heroTitle: 'Pushim larg zhurmës', servicesTitle: 'Dhomat', aboutTitle: 'Rreth bujtinës', locationTitle: 'Si të vish', galleryTitle: 'Galeria', bookingLabel: 'Rezervo qëndrimin' },
  'salon-bukurie': { category: 'Sallon bukurie', heroTitle: 'Koha jote për vete', servicesTitle: 'Shërbimet', aboutTitle: 'Rreth sallonit', locationTitle: 'Lokacioni dhe orari', galleryTitle: 'Galeria', bookingLabel: 'Rezervo termin' },
  'sallon-dasmash': { category: 'Sallon dasmash', heroTitle: 'Dita që nuk harrohet', servicesTitle: 'Sallat dhe menytë', aboutTitle: 'Rreth sallës', locationTitle: 'Ku ndodhemi', galleryTitle: 'Galeria', bookingLabel: 'Rezervo datën' },
  autoshkolla: { category: 'Autoshkollë', heroTitle: 'Merre patentën pa stres', servicesTitle: 'Kategoritë dhe çmimet', aboutTitle: 'Rreth autoshkollës', locationTitle: 'Ku ndodhemi', galleryTitle: 'Veturat tona', bookingLabel: 'Rezervo orën' },
  dyqan: { category: 'Dyqan', heroTitle: 'Mirë se vjen', servicesTitle: 'Produktet', aboutTitle: 'Rreth nesh', locationTitle: 'Ku ndodhemi', galleryTitle: 'Galeria', bookingLabel: '' },
};

/** "Tjetër": the closest template by the words the owner used. */
export function guessTemplate(text: string): Template {
  const t = text.toLowerCase();
  if (/autoshkoll|auto\s*shkoll|patent[ëe]|vozitj|kategoria\s+[abcd]\b/.test(t)) return 'autoshkolla';
  if (/dasm|fejes|kanagjeq/.test(t)) return 'sallon-dasmash';
  if (/berber|qethje|mjek[ëe]r\b/.test(t)) return 'berber';
  if (/dent|dh[ëe]mb|klinik|mjek|ordinanc|laborator/.test(t)) return 'klinike-dentare';
  if (/bujtin|dhom[ëe]|hotel|kasolle|vila|apartament|nat[ëa]\b/.test(t)) return 'bujtine';
  if (/restorant|kafe|kafene|picer|pizz|menu|meny|qebap|byrek|gatime|embëltore|ëmbëltore/.test(t)) return 'restorant-kafe';
  if (/sallon|flok|manikyr|pedikyr|makeup|grim|vetull|qerpik|masazh|estetik/.test(t)) return 'salon-bukurie';
  return 'dyqan';
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const PHONE_RE = /(?:\+|00)?383[\s\-/]?\d{2}[\s\-/]?\d{3}[\s\-/]?\d{3}|\b0[2-4]\d[\s\-/]?\d{3}[\s\-/]?\d{3}\b|\+\d{8,15}/g;
const PRICE_RE = /^(.*?)(?:\s*[:\-–]\s*|\s+)(nga\s+)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|euro\b|eur\b)\s*(.*)$/i;
const RANGE_RE = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:[–—-]|deri(?:\s+n[ëe])?)\s*(\d{1,2})(?:[:.](\d{2}))?/;
const HOURS_HINT = /hapur|orari|punojm|hapemi|[çc]do dit|mbyllur/i;

export function splitSentences(text: string): string[] {
  const guarded = text.replace(/\b(Rr|rr|Nr|nr|Dr|dr|Blvd|p\.sh|Sh\.p\.k)\./g, '$1§');
  return guarded.split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/§/g, '.').trim()).filter(Boolean);
}

function parseServices(sentences: string[]): ServiceItem[] {
  const items: ServiceItem[] = [];
  for (const s of sentences) {
    if (!/€|euro|eur\b/i.test(s)) continue;
    for (const chunk of s.replace(/[.!?]+$/, '').split(/[,;]|\s+dhe\s+/)) {
      const m = PRICE_RE.exec(chunk.trim());
      if (!m) continue;
      let name = m[1].trim().replace(/^(dhe|e|me|kemi|ofrojm[ëe])\s+/i, '').replace(/\s+(kushton|[ëe]sht[ëe]|p[ëe]r|vet[ëe]m)$/i, '').replace(/[:\-–]+$/, '').trim();
      let duration: number | null = null;
      const dm = /(\d{2,3})\s*min\w*/i.exec(name);
      if (dm) { duration = Number(dm[1]); name = name.replace(dm[0], '').replace(/[()]/g, '').trim(); }
      if (!name || words(name).length > 6 || name.length > 48) continue;
      const amount = m[3].replace('.', ',').replace(/,00$/, '');
      let tail = (m[4] || '').trim();
      let suffix = '';
      const night = /^(?:\/\s*|p[ëe]r\s+)?(?:nj[ëe]\s+)?(nata|nat[ëe]|nate)\b\s*/i.exec(tail);
      const person = /^(?:\/\s*|p[ëe]r\s+)?(person\w*|veta)\b\s*/i.exec(tail);
      if (night) { suffix = ' / natë'; tail = tail.slice(night[0].length); }
      else if (person) { suffix = ' / person'; tail = tail.slice(person[0].length); }
      tail = tail.replace(/^[,(]+|[).]+$/g, '').trim();
      items.push({
        name: cap(name), description: tail && words(tail).length <= 12 ? cap(tail) : '',
        price: `${m[2] ? 'nga ' : ''}${amount} €${suffix}`, duration, tag: '', image: { src: '', alt: '' },
      });
      if (items.length >= 14) return items;
    }
  }
  return items;
}

function parseHours(sentences: string[]): { rows: { days: string; time: string }[]; used: Set<string> } {
  const used = new Set<string>();
  let main = '', sat = '', sun = '', everyDay = false;
  const fmt = (m: RegExpExecArray) => `${pad2(Number(m[1]))}:${m[2] || '00'} – ${pad2(Number(m[3]))}:${m[4] || '00'}`;
  for (const s of sentences) {
    if (!HOURS_HINT.test(s)) continue;
    const clean = s.replace(PHONE_RE, ' ');
    let hit = false;
    for (const chunk of clean.split(/[,;]|\s+dhe\s+/)) {
      const r = RANGE_RE.exec(chunk);
      const valid = r && Number(r[1]) <= 24 && Number(r[3]) <= 24 && !/€|euro/i.test(chunk);
      const closed = /mbyllur|pushim/i.test(chunk);
      const value = valid ? fmt(r!) : closed ? 'Mbyllur' : '';
      if (!value) continue;
      hit = true;
      if (/shtun/i.test(chunk)) sat = value;
      else if (/diel/i.test(chunk)) sun = value;
      else if (valid) { main = value; if (/[çc]do dit/i.test(clean)) everyDay = true; }
    }
    if (hit) used.add(s);
  }
  const rows: { days: string; time: string }[] = [];
  if (main) rows.push({ days: everyDay && !sat && !sun ? 'Çdo ditë' : sat ? 'E hënë – E premte' : sun ? 'E hënë – E shtunë' : 'Hapur', time: main });
  if (sat) rows.push({ days: 'E shtunë', time: sat });
  if (sun) rows.push({ days: 'E diel', time: sun });
  return { rows, used };
}

function parseAddress(text: string): string {
  const street = /\b(?:Rr\.|Rruga|Bulevardi|Blvd\.?|Sheshi)\s+[^.,;\n]+/i.exec(text.replace(/\b(Rr|rr|Blvd)\.\s*/g, '$1. '));
  const landmark = /\b(?:te|tek|p[ëe]rball[ëe]|af[ëe]r|pran[ëe])\s+[A-ZÇË][^.,;\n]*/.exec(text);
  const village = /\bfshati\s+[A-ZÇË][\p{L}]+/u.exec(text);
  return [street?.[0], village?.[0], landmark?.[0]].filter(Boolean).map((s) => s!.trim()).join(', ').slice(0, 120);
}

export function localFill(input: FillInput): Content {
  const text = (input.text || '').trim();
  const template: Template = input.template === 'auto' ? guessTemplate(`${input.name} ${text}`) : input.template;
  const d = TEMPLATE_DEFAULTS[template];
  const category = input.template === 'auto' ? '' : d.category;
  const name = input.name.trim();
  const city = input.city.trim();
  const sentences = splitSentences(text);

  // phone: from the description, else the number given in the form
  const found = (text.match(PHONE_RE) || []).map((p) => normalizePhone(p)).find(Boolean);
  const e164 = found || input.contactPhone || '';
  const digits = waDigits(e164);

  const sinceM = /(?:q[ëe] nga|prej vitit|nga viti|since)\s*(?:viti\s*)?((?:19|20)\d{2})/i.exec(text);
  const since = sinceM ? sinceM[1] : '';
  const items = parseServices(sentences);
  const hours = parseHours(sentences);
  const address = parseAddress(text);

  // about: the owner's own sentences that are not price lists, hours or just a phone number
  const aboutSentences = sentences
    .filter((s) => !/€|euro|eur\b/i.test(s) && !hours.used.has(s))
    .map((s) => s.replace(PHONE_RE, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim())
    .filter((s) => words(s).length >= 2);
  let about = '';
  for (const s of aboutSentences) {
    const next = (about ? about + ' ' : '') + (/[.!?]$/.test(s) ? s : s + '.');
    if (words(next).length > 70) break;
    about = next;
  }
  if (!about) about = `${name} ${category ? `është ${category.toLowerCase()} ` : 'ndodhet '}në ${city}.`;

  const points: string[] = [];
  if (/parking/i.test(text)) points.push('Parking');
  if (/wi-?fi/i.test(text)) points.push('Wi-Fi');
  if (/kart[ëe]\b|pos\b/i.test(text)) points.push('Pagesë me kartë');
  if (/d[ëe]rges/i.test(text)) points.push('Dërgesë');
  if (/gjith[ëe] vitin/i.test(text)) points.push('Hapur gjithë vitin');
  if (/m[ëe]ngjes/i.test(text)) points.push('Mëngjes');

  const highlights: { value: string; label: string }[] = [];
  if (since) highlights.push({ value: since, label: 'viti i hapjes' });
  const fact = /\b(\d{1,3})\s+(dhoma|berber[ëe]|mjek[ëe]|dentist[ëe]|tavolina|karrige|vende|shtretër|mysafir[ëe]|salla|instruktor[ëe]|vetura)\b/i.exec(text);
  if (fact) highlights.push({ value: fact[1], label: fact[2].toLowerCase() });
  if (items.length >= 3) highlights.push({ value: String(items.length), label: template === 'dyqan' ? 'produkte' : template === 'bujtine' || template === 'sallon-dasmash' ? 'oferta' : 'shërbime' });

  const place = [category, city].filter(Boolean).join(' · ');
  const subtitle = `${category || name} në ${city}${address ? `, ${address}` : ''}${since ? `, që nga ${since}` : ''}.`;
  const galleryCount = Math.max(0, Math.min(8, input.photoCount - 2));

  const content: Content = {
    meta: { template, lang: 'sq', title: `${name} · ${category ? `${category} në ${city}` : city}`.slice(0, 60), description: subtitle.slice(0, 155) },
    theme: { accent: '', variant: '' },
    brand: { name, category, city, since },
    hero: { eyebrow: place, title: d.heroTitle, subtitle, image: { src: '', alt: input.photoCount > 0 ? `${name}, ${city}` : '' }, video: { src: '', poster: '' } },
    about: { title: d.aboutTitle, text: about, points: points.slice(0, 6), image: { src: '', alt: input.photoCount > 1 ? `${name}, pamje nga brenda` : '' } },
    services: {
      title: d.servicesTitle, intro: '',
      groups: [{ name: '', items: items.length ? items : [{ name: 'Na shkruaj për çmimet', description: '', price: '', duration: null, tag: '', image: { src: '', alt: '' } }] }],
    },
    gallery: { title: d.galleryTitle, images: Array.from({ length: galleryCount }, (_, i) => ({ src: '', alt: `${name}, foto ${i + 1}` })) },
    reviews: { title: '', rating: '', count: '', source: '', items: [] },
    location: { title: d.locationTitle, address, city, mapQuery: '', note: '', hours: hours.rows },
    contact: { phone: digits, phoneDisplay: displayPhone(e164), whatsapp: '', whatsappMessage: '', email: '', instagram: '', facebook: '' },
    booking: { enabled: !!input.bookingUrl, url: input.bookingUrl || '', label: d.bookingLabel },
    footer: { note: '' },
  };
  if (highlights.length) content.highlights = highlights.slice(0, 4);
  return content;
}
