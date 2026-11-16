// v6: global search on "Gjej një termin".
import { beforeAll, describe, expect, it } from 'vitest';
import { createBusiness, defaultHours, findBusinesses } from '../lib/business';
import { randomId } from '../lib/config';
import { db } from '../lib/db';
import { fold, searchScore, searchWords } from '../lib/search';

const tag = randomId(5).toLowerCase().replace(/[^a-z]/g, 'x');
let barber = '', dentist = '';

beforeAll(async () => {
  const u1 = await db.user.create({ data: { phone: `+38345${String(Date.now()).slice(-6)}`, name: 'Kërkim 1' } });
  const b1 = await createBusiness(u1, { name: `Berberia Çika ${tag}`, category: 'berber', city: 'Prishtinë', services: [{ name: 'Qethje me gërshërë', durationMin: 30, price: 6 }, { name: 'Rregullim mjekre', durationMin: 20, price: 4 }], hours: defaultHours('berber') });
  const u2 = await db.user.create({ data: { phone: `+38346${String(Date.now()).slice(-6)}`, name: 'Kërkim 2' } });
  const b2 = await createBusiness(u2, { name: `Klinika Buzëqeshja ${tag}`, category: 'dentist', city: 'Ferizaj', services: [{ name: 'Pastrim dhëmbësh', durationMin: 45, price: 30 }], hours: defaultHours('dentist') });
  await db.business.updateMany({ where: { id: { in: [b1.id, b2.id] } }, data: { onboardedAt: new Date() } });
  barber = b1.slug; dentist = b2.slug;
});

describe('v6: global search', () => {
  it('ignores case and the letters ë / ç', () => {
    expect(fold('Prishtinë')).toBe('prishtine');
    expect(fold('ÇIKA, Gërshërë!')).toBe('cika gershere');
    expect(searchWords('berber në Prishtinë')).toEqual(['berber', 'prishtine']);
  });

  it('every word must match somewhere; the name counts more than a service', () => {
    const b = { name: 'Berberia Arti', city: 'Gjakovë', category: 'berber', address: '', description: '', services: [{ name: 'Qethje', description: '' }] };
    expect(searchScore(b, ['arti']).score).toBeGreaterThan(searchScore(b, ['qethje']).score);
    expect(searchScore(b, ['qethje']).service).toBe('Qethje');
    expect(searchScore(b, ['qethje', 'gjakove']).score).toBeGreaterThan(0);
    expect(searchScore(b, ['qethje', 'peje']).score).toBe(0);
  });

  it('finds businesses by name, service, city or type, written with or without ë / ç', async () => {
    const now = new Date();
    const slugs = async (q: string) => (await findBusinesses(undefined, undefined, now, q)).map((b) => b.slug);
    expect(await slugs(`cika ${tag}`)).toEqual([barber]);
    expect(await slugs(`gershere ${tag}`)).toEqual([barber]);
    expect(await slugs(`prishtine ${tag}`)).toContain(barber);
    expect(await slugs(`dhembesh ${tag}`)).toEqual([dentist]);
    expect(await slugs(`dentist ${tag}`)).toEqual([dentist]);
    expect(await slugs(`${tag} ferizaj qethje`)).toEqual([]);
    const hit = (await findBusinesses(undefined, undefined, now, `mjekre ${tag}`))[0];
    expect(hit.matchedService).toBe('Rregullim mjekre');
  });

  it('works together with the city and type filters', async () => {
    const now = new Date();
    expect((await findBusinesses('Ferizaj', undefined, now, tag)).map((b) => b.slug)).toEqual([dentist]);
    expect((await findBusinesses(undefined, 'berber', now, tag)).map((b) => b.slug)).toEqual([barber]);
  });
});
