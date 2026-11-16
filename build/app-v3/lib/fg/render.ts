// Server rendering of the Faqja Gati templates: template HTML + content → static HTML (jsdom + Fable's fg.js).
// Two separate paths (01-product-design.md §6.3):
//   renderPreview: watermark, masked phone, every link "#", no map, no booking link, low-resolution images.
//   renderLive:    only called for pages whose status is "live".
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { maskPhone } from '../phone';
import type { Content, Template } from './schema';

const root = () => path.join(process.cwd(), 'templates');

type FGRuntime = { fill: (doc: Document, content: unknown, options?: { jsonLd?: boolean }) => unknown };
let fg: FGRuntime | null = null;
function runtime(): FGRuntime {
  if (!fg) {
    const code = fs.readFileSync(path.join(root(), 'fg.js'), 'utf8');
    const mod: { exports: unknown } = { exports: {} };
    // fg.js is a UMD file; give it `module` and hide browser globals so it does not try to boot.
    new Function('module', 'exports', 'self', 'window', 'document', code)(mod, mod.exports, undefined, undefined, undefined);
    fg = mod.exports as FGRuntime;
  }
  return fg;
}

const htmlCache = new Map<string, string>();
function templateHtml(template: Template): string {
  let html = htmlCache.get(template);
  if (!html || process.env.NODE_ENV !== 'production') {
    html = fs.readFileSync(path.join(root(), template, 'index.html'), 'utf8');
    htmlCache.set(template, html);
  }
  return html;
}

export function demoContent(template: Template): Content {
  return JSON.parse(fs.readFileSync(path.join(root(), template, 'content.json'), 'utf8'));
}

/** Uploaded photos in order: first → hero, second → about, then product/room/hall photos (dyqan, bujtine, sallon-dasmash), the rest → gallery. */
export function assignPhotos(content: Content, urls: string[]): Content {
  const c: Content = JSON.parse(JSON.stringify(content));
  const queue = [...urls];
  const put = (img: { src: string; alt: string } | undefined, fallbackAlt: string) => {
    const src = queue.shift();
    return src ? { src, alt: img?.alt || fallbackAlt } : img || { src: '', alt: '' };
  };
  c.hero.image = put(c.hero.image, c.brand.name);
  c.about = c.about || {};
  c.about.image = put(c.about.image, c.brand.name);
  if (c.meta.template === 'dyqan' || c.meta.template === 'bujtine') {
    for (const g of c.services.groups) for (const it of g.items) if (queue.length) it.image = put(it.image, it.name);
  }
  // sallon-dasmash: only the halls get a photo (first group, items the content gave a photo brief); menus stay a price list.
  if (c.meta.template === 'sallon-dasmash') {
    for (const it of c.services.groups[0]?.items || []) if (queue.length && it.image?.alt) it.image = put(it.image, it.name);
  }
  const gallery = (c.gallery?.images || []).filter((g) => g.src);          // keep images that already have a source
  while (queue.length && gallery.length < 8) gallery.push({ src: queue.shift()!, alt: `${c.brand.name}, foto ${gallery.length + 1}` });
  // With no uploads the gallery keeps the template's tonal placeholders only when the content asked for them.
  c.gallery = { title: c.gallery?.title || '', images: urls.length ? gallery : c.gallery?.images || [] };
  return c;
}

const PHONE_IN_TEXT = /(?:\+|00)?383[\s\-/]?\d{2}[\s\-/]?\d{3}[\s\-/]?\d{3}|\b0[2-4]\d[\s\-/]?\d{3}[\s\-/]?\d{3}\b|\+\d{8,15}/g;

/** Remove everything a visitor could use to reach the business from a preview. */
export function scrubForPreview(content: Content): Content {
  const c: Content = JSON.parse(JSON.stringify(content));
  const shown = c.contact.phoneDisplay || (c.contact.phone ? '+' + c.contact.phone : '');
  c.contact = { phone: '', phoneDisplay: shown ? maskPhone(shown) : '', whatsapp: '', whatsappMessage: '', email: '', instagram: c.contact.instagram ? '•••' : '', facebook: '' };
  c.booking = { ...c.booking, url: c.booking.enabled ? '#' : '' };
  c.location.mapQuery = '';
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(PHONE_IN_TEXT, '••• ••• •••');
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) (v as Record<string, unknown>)[k] = walk((v as Record<string, unknown>)[k]); }
    return v;
  };
  for (const key of ['hero', 'about', 'services', 'faq', 'footer', 'highlights', 'meta', 'reviews'] as const) if (c[key]) walk(c[key]);
  // Audit H4: the preview must not contain the whole site. Keep the first half of every list
  // (enough to judge the design) and replace the rest with placeholder bars, not the real text.
  const bar = (len: number) => '█'.repeat(Math.max(4, Math.min(len, 18)));
  const hideFrom = (n: number) => Math.max(1, Math.ceil(n / 2));
  for (const g of c.services?.groups ?? []) {
    g.items = g.items.map((it, i) => (i < hideFrom(g.items.length) ? it : {
      ...it, name: bar(it.name.length), description: it.description ? bar(it.description.length) : '', price: it.price ? '•• €' : '',
    }));
  }
  if (Array.isArray(c.faq)) c.faq = c.faq.map((f, i) => (i < 1 ? f : { q: f.q, a: bar(f.a.length) + ' ' + bar(12) }));
  if (c.reviews?.items) c.reviews.items = c.reviews.items.map((r, i) => (i < 1 ? r : { ...r, text: bar(r.text.length) + ' ' + bar(10) }));
  return c;
}

function build(content: Content, preview: boolean): string {
  const template = content.meta.template;
  const dom = new JSDOM(templateHtml(template));
  const doc = dom.window.document;
  const html = doc.documentElement;

  doc.querySelectorAll('script[src]').forEach((s) => s.remove());
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
    const href = l.getAttribute('href') || '';
    if (href === '../base.css') l.setAttribute('href', '/fg/base.css');
    else if (href === 'style.css') l.setAttribute('href', `/fg/${template}/style.css`);
  });
  html.removeAttribute('data-fg-demo');
  html.setAttribute('data-fg-static', '');

  if (preview) {
    html.setAttribute('data-fg-preview', '');
    const link = doc.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', '/fg/preview.css');
    doc.head.appendChild(link);
    const robots = doc.createElement('meta');
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', 'noindex, nofollow');
    doc.head.appendChild(robots);
  }

  runtime().fill(doc, preview ? scrubForPreview(content) : content, { jsonLd: !preview });

  if (preview) {
    doc.querySelectorAll('a[href]').forEach((a) => { a.setAttribute('href', '#'); a.removeAttribute('target'); });
    doc.querySelectorAll('iframe').forEach((f) => f.removeAttribute('src'));
    doc.querySelectorAll('form').forEach((f) => f.removeAttribute('action'));
    // The ribbon ("Kjo është parapamje…") is added in the browser by FG.lockPreview; the watermark is pure CSS.
  }

  const script = doc.createElement('script');
  script.setAttribute('src', '/fg/fg.js');
  script.setAttribute('defer', '');
  doc.body.appendChild(script);
  const out = '<!doctype html>\n' + html.outerHTML;
  dom.window.close();
  return out;
}

export const renderPreview = (content: Content) => build(content, true);
export const renderLive = (content: Content) => build(content, false);
