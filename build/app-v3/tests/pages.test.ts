// Faqja Gati: local filler, preview protection and the payment gate (no live page without payment).
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../lib/db';
import { guessTemplate, localFill } from '../lib/fg/filler';
import { readStored, removePageFiles } from '../lib/fg/images';
import { demoContent, renderLive, renderPreview } from '../lib/fg/render';
import { TEMPLATES, validateContent } from '../lib/fg/schema';
import { addAsset, checkout, createPage, liveAssetKey, liveHtml, markPaid, previewAssetKey, previewHtml, runGeneration, setPublished } from '../lib/pages';
import { AppError } from '../lib/db';

const TEXT = 'Berber në Gjakovë, te Çarshia e Madhe. Qethje 5 €, mjekër 3 €, qethje + mjekër 7 €. Hapur 9–20, të dielën mbyllur. 049 123 456. Punojmë që nga 2015.';
const ORIGIN = 'http://localhost:3000';
let pageId = '';
let assetId = '';
let adminId = '';
const sub = `test-${Date.now().toString(36)}`;

beforeAll(async () => {
  adminId = (await db.user.create({ data: { phone: `+38345${String(Date.now()).slice(-6)}`, name: 'Admin', role: 'admin' } })).id;
});
afterAll(async () => {
  if (pageId) await removePageFiles(pageId);
  await db.$disconnect();
});

describe('local filler (no API key)', () => {
  it('builds valid content from the description and invents nothing', () => {
    const c = localFill({ template: 'berber', name: 'Berberi Arti', city: 'Gjakovë', text: TEXT, photoCount: 0, contactPhone: '+38344000000' });
    expect(validateContent(c)).toEqual([]);
    expect(c.contact.phone).toBe('38349123456');                       // the number in the text wins over the form
    expect(c.contact.phoneDisplay).toBe('049 123 456');
    expect(c.brand.since).toBe('2015');
    const items = c.services.groups[0].items;
    expect(items.map((i) => [i.name, i.price])).toEqual([['Qethje', '5 €'], ['Mjekër', '3 €'], ['Qethje + mjekër', '7 €']]);
    expect(c.location.hours).toEqual([{ days: 'E hënë – E shtunë', time: '09:00 – 20:00' }, { days: 'E diel', time: 'Mbyllur' }]);
    expect(c.location.address).toContain('te Çarshia e Madhe');
    expect(c.reviews?.items).toEqual([]);                              // reviews are never invented
    expect(c.booking.enabled).toBe(false);
  });

  it('understands "nga" prices, per-night prices and Saturday hours', () => {
    const c = localFill({
      template: 'bujtine', name: 'Bujtina Rugova', city: 'Pejë', photoCount: 3, contactPhone: '+38349333333',
      text: 'Bujtinë në Rugovë, fshati Drelaj. Dhomë dyshe 45 € nata me mëngjes, kasolle nga 70 €. 8 dhoma. Hapur 8–22, të shtunën 9–14.',
    });
    expect(validateContent(c)).toEqual([]);
    expect(c.services.groups[0].items[0]).toMatchObject({ name: 'Dhomë dyshe', price: '45 € / natë', description: 'Me mëngjes' });
    expect(c.services.groups[0].items[1]).toMatchObject({ name: 'Kasolle', price: 'nga 70 €' });
    expect(c.location.hours).toEqual([{ days: 'E hënë – E premte', time: '08:00 – 22:00' }, { days: 'E shtunë', time: '09:00 – 14:00' }]);
    expect(c.contact.phone).toBe('38349333333');
    expect(c.gallery?.images).toHaveLength(1);                         // 3 photos: hero, about, 1 gallery
  });

  it('stays valid with almost nothing to go on', () => {
    for (const template of [...TEMPLATES, 'auto' as const]) {
      const c = localFill({ template, name: 'Biznesi', city: 'Prizren', text: 'Jemi një biznes i vogël familjar.', photoCount: 0, contactPhone: '+38344111222' });
      expect(validateContent(c)).toEqual([]);
    }
  });
});

describe('templates render on the server', () => {
  it('all demo contents are valid and render in both modes', () => {
    for (const t of TEMPLATES) {
      const content = demoContent(t);
      expect(validateContent(content), t).toEqual([]);
      const live = renderLive(content);
      expect(live, t).toContain(content.brand.name);
      expect(live, t).toContain('data-fg-static');
      expect(live, t).not.toContain('data-fg-preview');
      expect(live, t).not.toMatch(/data-(t|if|each|attr|img)=/);       // every binding was resolved
      const preview = renderPreview(content);
      expect(preview, t).toContain('data-fg-preview');
      expect(preview, t).toContain('/fg/preview.css');
    }
  });

  it('a business name with </script> cannot break out of the JSON-LD block (audit: stored XSS)', () => {
    const content = demoContent('berber');
    content.brand.name = 'Arti</script><script>alert(1)</script>';
    const live = renderLive(content);
    expect(live).not.toContain('<script>alert(1)</script>');
    expect(live).toContain('\\u003c/script>');
  });
});

describe('preview protection and the payment gate', () => {
  it('generation ends in a watermarked preview', async () => {
    const page = await createPage({ template: 'berber', name: 'Berberi Test', city: 'Gjakovë', text: TEXT, contactPhone: '044 765 432', ip: '10.0.0.9' });
    pageId = page.id;
    expect(page.id).toMatch(/^[A-Za-z0-9]{20}$/);
    const img = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#7a5a3a' } }).jpeg().toBuffer();
    assetId = (await addAsset(pageId, img)).id;
    const done = await runGeneration(pageId);
    expect(done.status).toBe('preview');
    expect(done.previewExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 13 * 864e5);
  });

  it('the preview has no way to reach the business', async () => {
    const html = await previewHtml(pageId);
    expect(html).toContain('data-fg-preview');
    expect(html).toContain('noindex');
    expect(html).toContain('Berberi Test');
    expect(html).not.toMatch(/049\s?123\s?456|38349123456/);           // phone masked in text and links
    expect(html).toContain('049 ••• •••');
    expect(html).not.toMatch(/wa\.me|tel:|google\.com\/maps|application\/ld\+json/);
    const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(3);
    expect(hrefs.every((h) => h === '#')).toBe(true);
    expect(html).toContain(`/faqja/${pageId}/img/${assetId}`);          // only the watermarked derivative is referenced
    expect(html).not.toContain('/p/');
  });

  it('preview images are small and watermarked; the original is not reachable', async () => {
    const key = await previewAssetKey(pageId, assetId);
    const meta = await sharp((await readStored(key!))!).metadata();
    expect(meta.width).toBeLessThanOrEqual(800);
    expect(key).toContain('.preview.');
    expect(await liveAssetKey(sub, assetId)).toBeNull();
  });

  it('there is no live page before payment, whatever is tried', async () => {
    expect(await liveHtml(sub, ORIGIN)).toBeNull();
    await db.page.update({ where: { id: pageId }, data: { subdomain: sub } });       // even with the address reserved
    expect(await liveHtml(sub, ORIGIN)).toBeNull();
    const r = await checkout(pageId, { method: 'bank', subdomain: sub }, ORIGIN);     // "E kreva pagesën" is not payment
    expect(r.reference).toMatch(/^FG-/);
    expect(r.amountCents).toBe(10000);
    expect((await db.page.findUniqueOrThrow({ where: { id: pageId } })).status).toBe('payment_pending');
    expect(await liveHtml(sub, ORIGIN)).toBeNull();
    expect(await liveAssetKey(sub, assetId)).toBeNull();
    expect(await previewHtml(pageId)).toContain('data-fg-preview');                  // still the watermark
  });

  it('Paysera cannot be chosen without keys', async () => {
    await expect(checkout(pageId, { method: 'paysera' }, ORIGIN)).rejects.toBeInstanceOf(AppError);
  });

  it('after an admin marks it paid the page is live, without watermark, with working links', async () => {
    const page = await markPaid(pageId, { method: 'bank', note: 'test', adminUserId: adminId });
    expect(page.status).toBe('live');
    const html = (await liveHtml(sub, ORIGIN))!;
    expect(html).toBeTruthy();
    expect(html).not.toContain('data-fg-preview');
    expect(html).not.toContain('preview.css');
    expect(html).toContain('tel:+38349123456');
    expect(html).toContain('wa.me/38349123456');
    expect(html).toContain(`/p/${sub}/img/${assetId}`);
    const key = await liveAssetKey(sub, assetId);
    expect(key).not.toContain('.preview.');
    expect((await sharp((await readStored(key!))!).metadata()).width).toBe(1600);
    const pay = await db.payment.findFirstOrThrow({ where: { pageId, status: 'paid' } });
    expect(pay.markedByUserId).toBe(adminId);
    expect(await db.auditLog.count({ where: { targetId: pageId, action: 'page.mark_paid' } })).toBe(1);
    expect(await previewHtml(pageId)).toContain('data-fg-preview');                  // the preview URL never turns into the live page
  });

  it('unpublishing takes the page down again', async () => {
    await setPublished(pageId, false, adminId);
    expect(await liveHtml(sub, ORIGIN)).toBeNull();
    expect(await liveAssetKey(sub, assetId)).toBeNull();
    await setPublished(pageId, true, adminId);
    expect(await liveHtml(sub, ORIGIN)).toBeTruthy();
  });

  it('an expired preview is no longer shown', async () => {
    const page = await createPage({ template: 'dyqan', name: 'Dyqani Test', city: 'Ferizaj', text: 'Dyqan lulesh në Ferizaj. Buqetë nga 15 €, bimë nga 8 €.', contactPhone: '044 765 433', ip: '10.0.0.9' });
    await runGeneration(page.id);
    await db.page.update({ where: { id: page.id }, data: { previewExpiresAt: new Date(Date.now() - 1000) } });
    await expect(previewHtml(page.id)).rejects.toMatchObject({ code: 'preview_expired' });
    await expect(checkout(page.id, { method: 'cash' }, ORIGIN)).rejects.toBeInstanceOf(AppError);
  });
});

describe('JOB A: wedding hall and driving school templates', () => {
  it('guesses the two new templates from the owner words', () => {
    expect(guessTemplate('Sallon dasmash në Gjakovë, deri në 600 mysafirë')).toBe('sallon-dasmash');
    expect(guessTemplate('Autoshkollë në Prishtinë. Kategoria B 320 €')).toBe('autoshkolla');
    expect(guessTemplate('Berber në Gjakovë, qethje 5 €')).toBe('berber');
    expect(guessTemplate('Lavazh në Ferizaj. Larje e plotë 10 €, ndërrim vaji nga 45 €')).toBe('lavazh-servis');
  });
  it('fills them locally with their own booking label', () => {
    const w = localFill({ template: 'sallon-dasmash', name: 'Salla Elita', city: 'Gjakovë', photoCount: 0, contactPhone: '+38349555120', text: 'Sallon dasmash në Gjakovë. Meny klasike 25 € për person, meny e plotë 32 € për person. Vizita 10–18.' });
    expect(validateContent(w)).toEqual([]);
    expect(w.booking.label).toBe('Rezervo datën');
    expect(w.services.groups[0].items[0]).toMatchObject({ name: 'Meny klasike', price: '25 € / person' });
    const a = localFill({ template: 'autoshkolla', name: 'Autoshkolla Timoni', city: 'Prishtinë', photoCount: 0, contactPhone: '+38344300450', text: 'Autoshkollë në Prishtinë. Kategoria B 320 €, kategoria A 220 €. Hapur 8–19.' });
    expect(validateContent(a)).toEqual([]);
    expect(a.booking.label).toBe('Rezervo orën');
    expect(a.services.groups[0].items.map((i) => i.price)).toEqual(['320 €', '220 €']);
  });
});
