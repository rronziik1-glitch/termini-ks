// Faqja Gati content fill. Calls the Claude API only when ANTHROPIC_API_KEY is set; otherwise (and when the
// model output fails validation twice) the deterministic local filler builds the content from the form.
// Prompt and schema: fable/01-product-design.md §6.4 and templates/schema.json.
import { config } from './config';
import { localFill, type FillInput } from './fg/filler';
import { isTemplate, toolSchema, validateContent, type Content } from './fg/schema';

export const SYSTEM_PROMPT = `You write the content for a one-page website of a small business in Kosovo.
You will receive what the owner told us. Return the page content by calling save_page_content.

LANGUAGE
- Write everything in standard Albanian as used in Kosovo, with correct ë and ç.
- Address the visitor as "ti". Warm, short, concrete. No clichés such as "cilësi e lartë",
  "eksperiencë e paharrueshme", "ne jemi pasionantë". No exclamation marks. No emoji.
- If the owner wrote in another language, still write in Albanian, unless they explicitly asked
  for another language.

TRUTH
- Use only facts given by the owner: services, prices, hours, address, phone, years, names.
- Never invent prices, reviews, awards, staff names, years of experience, or an address.
- If a fact is missing, leave that field empty or omit the optional section. An honest short
  page is better than a full invented one.
- Reviews: include only reviews the owner pasted. Otherwise return an empty reviews.items list.
- You may write: the hero title and subtitle, section titles, the about text, and one-line
  service descriptions, as long as they only restate or lightly rephrase given facts.

SHAPE
- hero.title: at most 6 words, no business name in it, no full stop at the end.
- hero.subtitle: one sentence, at most 18 words, says what it is and where.
- about.text: 2 to 4 sentences, at most 70 words.
- Service names as the owner wrote them, spelling corrected. description at most 12 words.
- Prices exactly as given, formatted "5 €" or "nga 30 €". No price given: empty string.
- Durations in minutes as a number when given; otherwise omit.
- Hours as rows like {"days": "E hënë – E shtunë", "time": "09:00 – 20:00"}; closed days
  as {"days": "E diel", "time": "Mbyllur"}.
- contact.phone in international digits only (Kosovo: 383 + number without the leading 0).
  contact.phoneDisplay as locals write it: "049 123 456".
- For every image slot write a short alt text describing what a suitable photo would show;
  leave src empty. The server assigns the photos.
- meta.template: use the template id you are given. Only when it is "auto", pick the closest of:
  berber, klinike-dentare, restorant-kafe, bujtine, salon-bukurie, dyqan.
- theme.accent: keep the template default (empty string) unless the owner named a brand colour.`;

export function userMessage(i: FillInput): string {
  return [
    `TEMPLATE: ${i.template}`,
    `BUSINESS NAME: ${i.name}`,
    `CITY: ${i.city}`,
    `OWNER'S DESCRIPTION:\n"""${i.text}"""`,
    `TEXT FROM THEIR OLD WEBSITE (may be empty, may contain junk; use only clear facts):\n"""${i.oldSiteText || ''}"""`,
    `PHOTOS UPLOADED: ${i.photoCount}`,
    `TERMINI BOOKING LINK: ${i.bookingUrl || 'none'}`,
    `REVISION NOTE FROM OWNER (may be empty): """${i.revisionNote || ''}"""`,
    i.revisionNote && i.previous ? `PREVIOUS CONTENT (return the same JSON with only the requested change):\n${JSON.stringify(i.previous)}` : '',
  ].filter(Boolean).join('\n');
}

/** Fields the server owns are forced after the model answers (template, booking, photos, a valid phone). */
export function normalize(raw: unknown, i: FillInput): Content {
  const c = (raw && typeof raw === 'object' ? JSON.parse(JSON.stringify(raw)) : {}) as Content;
  const base = localFill(i);
  c.meta = { ...(c.meta || {}), template: i.template !== 'auto' ? i.template : isTemplate(c.meta?.template) ? c.meta.template : base.meta.template };
  c.booking = { enabled: !!i.bookingUrl, url: i.bookingUrl || '', label: c.booking?.label || base.booking.label };
  c.contact = c.contact || base.contact;
  if (!/^[0-9]{8,15}$/.test(c.contact.phone || '')) { c.contact.phone = base.contact.phone; c.contact.phoneDisplay = base.contact.phoneDisplay; }
  if (c.contact.whatsapp && !/^[0-9]{8,15}$/.test(c.contact.whatsapp)) c.contact.whatsapp = '';
  if (c.theme?.accent && !/^#[0-9a-fA-F]{6}$/.test(c.theme.accent)) c.theme.accent = '';
  const strip = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(strip);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ('src' in o && 'alt' in o) o.src = '';
      Object.values(o).forEach(strip);
    }
  };
  strip(c);
  return c;
}

type ApiResult = { input: unknown; inputTokens: number; outputTokens: number };

async function callClaude(model: string, user: string): Promise<ApiResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 4096, system: SYSTEM_PROMPT,
      tools: [{ name: 'save_page_content', description: 'Save the content of the business page.', input_schema: toolSchema() }],
      tool_choice: { type: 'tool', name: 'save_page_content' },
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content?: { type: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const tool = (data.content || []).find((b) => b.type === 'tool_use');
  if (!tool) throw new Error('Claude API: no tool_use block in the reply');
  return { input: tool.input, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 };
}

export type FillResult = { content: Content; model: string; inputTokens: number; outputTokens: number; ok: boolean; error: string };

export async function fillContent(i: FillInput): Promise<FillResult> {
  if (!config.anthropicKey()) return { content: localFill(i), model: 'local-filler', inputTokens: 0, outputTokens: 0, ok: true, error: '' };

  let inputTokens = 0, outputTokens = 0, error = '';
  // Haiku for the fill; Sonnet when there is an old website to digest, and for the retry.
  let model = i.oldSiteText ? config.modelRetry() : config.modelFill();
  let user = userMessage(i);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await callClaude(model, user);
      inputTokens += r.inputTokens; outputTokens += r.outputTokens;
      const content = normalize(r.input, i);
      const problems = validateContent(content);
      if (!problems.length) return { content, model, inputTokens, outputTokens, ok: true, error: '' };
      error = problems.join('; ');
      user = `${userMessage(i)}\n\nYOUR PREVIOUS ANSWER FAILED VALIDATION. Fix these problems and call the tool again:\n${problems.join('\n')}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    model = config.modelRetry();
  }
  console.warn(`[faqja-gati] model fill failed, using the local filler: ${error}`);
  return { content: localFill(i), model: 'local-filler (fallback)', inputTokens, outputTokens, ok: false, error };
}
