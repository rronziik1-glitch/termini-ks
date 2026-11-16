// Page content shape (templates/schema.json) + validation. One shape for all six templates.
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../templates/schema.json';

export const TEMPLATES = ['berber', 'klinike-dentare', 'restorant-kafe', 'bujtine', 'salon-bukurie', 'dyqan'] as const;
export type Template = (typeof TEMPLATES)[number];
export const isTemplate = (s: unknown): s is Template => typeof s === 'string' && (TEMPLATES as readonly string[]).includes(s);
export const VARIANTS = ['', 'a', 'b', 'c'];

export type Img = { src: string; alt: string };
export type ServiceItem = { name: string; description?: string; price?: string; duration?: number | null; tag?: string; image?: Img };
export type Content = {
  meta: { template: Template; lang?: string; title?: string; description?: string };
  theme?: { accent?: string; variant?: string };
  brand: { name: string; category?: string; city?: string; since?: string };
  hero: { eyebrow?: string; title: string; subtitle?: string; image?: Img; video?: { src?: string; poster?: string } };
  highlights?: { value: string; label: string }[];
  about?: { title?: string; text?: string; points?: string[]; image?: Img };
  services: { title?: string; intro?: string; groups: { name?: string; items: ServiceItem[] }[] };
  gallery?: { title?: string; images?: Img[] };
  reviews?: { title?: string; rating?: string; count?: string; source?: string; items?: { name: string; text: string; rating?: number }[] };
  team?: { title?: string; members?: { name: string; role?: string; image?: Img }[] };
  faq?: { q: string; a: string }[];
  location: { title?: string; address?: string; city?: string; mapQuery?: string; note?: string; hours: { days: string; time: string }[] };
  contact: { phone: string; phoneDisplay?: string; whatsapp?: string; whatsappMessage?: string; email?: string; instagram?: string; facebook?: string };
  booking: { enabled: boolean; url?: string; label?: string };
  footer?: { note?: string };
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema as object);

/** Returns a list of problems; empty = valid. */
export function validateContent(content: unknown): string[] {
  if (validate(content)) return [];
  return (validate.errors || []).slice(0, 12).map((e) => `${e.instancePath || '/'} ${e.message || 'invalid'}`);
}

/** The JSON schema as a tool input_schema for the Claude API (without the $schema/$id keys). */
export function toolSchema(): Record<string, unknown> {
  const { $schema: _s, $id: _i, title: _t, ...rest } = schema as Record<string, unknown>;
  return rest;
}

/** Which business category each template is offered for (Termini category → template). */
export const CATEGORY_TEMPLATE: Record<string, Template | 'auto'> = {
  berber: 'berber', salon: 'salon-bukurie', dentist: 'klinike-dentare', klinike: 'klinike-dentare',
  bujtine: 'bujtine', restorant: 'restorant-kafe', dyqan: 'dyqan', tjeter: 'auto',
};
