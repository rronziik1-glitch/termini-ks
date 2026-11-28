// Seed: category presets, an admin, and 3 example businesses (barber in Gjakova, dentist in Prishtina,
// guesthouse in Rugova) with bookings around today, plus two Faqja Gati pages (one live, one in preview).
import './env';
import { recountCustomer } from '../lib/booking';
import { createBusiness, defaultHours, type HoursDoc, type ServiceInput } from '../lib/business';
import { randomId } from '../lib/config';
import { db } from '../lib/db';
import { createPage, markPaid, runGeneration } from '../lib/pages';
import { CATEGORY_PRESETS } from '../lib/presets';
import { bundledListings, importListings } from '../lib/listings';
import { addDays, localToUtc, toLocal, weekdayOf } from '../lib/time';

const ADMIN = '+38349000000';

async function owner(phone: string, name: string) {
  return db.user.create({ data: { phone, name, role: 'owner' } });
}

type Seed = { time: string; day: number; service: number; name: string; phone?: string; status?: string; note?: string };

async function addBookings(businessId: string, list: Seed[]) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, include: { services: { orderBy: { sort: 'asc' } }, staff: true } });
  const now = new Date();
  const today = toLocal(now, b.timezone).date;
  // Example bookings land on open days only: the barber and the dentist are closed on Sundays, so
  // "day 0" is the first open day from today and the other offsets count open days from there.
  const open = (date: string) => b.category === 'bujtine' || weekdayOf(date) !== 7;
  const openDay = (n: number) => {
    let date = today;
    while (!open(date)) date = addDays(date, 1);
    for (let left = Math.abs(n); left > 0; ) { date = addDays(date, n > 0 ? 1 : -1); if (open(date)) left--; }
    return date;
  };
  for (const s of list) {
    const date = openDay(s.day);
    const service = b.services[s.service];
    const startsAt = localToUtc(date, s.time, b.timezone);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);
    let customer = s.phone ? await db.customer.findUnique({ where: { businessId_phone: { businessId, phone: s.phone } } }) : null;
    if (!customer) customer = await db.customer.create({ data: { businessId, name: s.name, phone: s.phone || null } });
    const status = s.status || (endsAt < now ? 'completed' : 'confirmed');
    await db.booking.create({
      data: {
        businessId, staffId: b.staff[0].id, serviceId: service.id, customerId: customer.id, startsAt, endsAt, status,
        source: s.phone ? 'link' : 'manual', serviceName: service.name, priceCents: service.priceCents, customerNote: s.note || '', token: randomId(22),
      },
    });
  }
  const customers = await db.customer.findMany({ where: { businessId } });
  await db.$transaction(async (tx) => { for (const c of customers) await recountCustomer(tx, c.id); });
}

async function main() {
  // 1. Category presets: needed by the app itself, safe to run again (also on the production database).
  for (const [category, p] of Object.entries(CATEGORY_PRESETS)) {
    const data = { servicesJson: JSON.stringify(p.services), hoursJson: JSON.stringify(p.hours) };
    await db.categoryPreset.upsert({ where: { category }, create: { category, ...data }, update: data });
  }
  // 2. Example businesses: only for local development. On PostgreSQL (production) they are skipped
  //    unless SEED_DEMO=1 is set on purpose.
  // v7: real businesses that are not on Termini yet (OpenStreetMap, best 100 by default, LISTINGS_LIMIT to change,
  //     LISTINGS_SEED=0 to skip). Safe to run on every deploy: matched on the OSM id, removed/claimed ones stay as they are.
  if (process.env.LISTINGS_SEED !== '0') {
    const added = await importListings(bundledListings());
    console.log(`Listings: ${added} new (OpenStreetMap).`);
  }

  if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '') && process.env.SEED_DEMO !== '1') {
    console.log('Category presets saved. Example businesses skipped on PostgreSQL (set SEED_DEMO=1 to add them).');
    return;
  }
  if (await db.user.count()) {
    console.log('Category presets saved. The database already has users, so no example data was added. Run `npm run db:setup` to reset a local database.');
    return;
  }
  const admin = await db.user.create({ data: { phone: ADMIN, name: 'Roni', role: 'admin' } });

  /* 1. Barber in Gjakova ------------------------------------------------------------ */
  const arti = await owner('+38349111111', 'Arti Hoxha');
  const berberServices: ServiceInput[] = [
    { name: 'Qethje', durationMin: 30, price: 5 },
    { name: 'Qethje + mjekër', durationMin: 45, price: 7 },
    { name: 'Mjekër', durationMin: 15, price: 3 },
    { name: 'Rruajtje klasike', durationMin: 20, price: 4, description: 'Me brisk dhe peshqir të nxehtë' },
    { name: 'Qethje për fëmijë', durationMin: 20, price: 4, description: 'Deri në 12 vjeç' },
    { name: 'Paketa e dhëndrit', durationMin: 75, price: 20, priceFrom: true, description: 'Qethje, mjekër dhe maskë' },
  ];
  const berberHours: HoursDoc = defaultHours('berber');
  berberHours.days[5].end = '18:00';
  const berber = await createBusiness(arti, {
    name: 'Berberi Arti', category: 'berber', city: 'Gjakovë', slug: 'berberi-arti', address: 'Rr. Ismail Qemali 12, te Çarshia e Madhe',
    services: berberServices, hours: berberHours, ownerName: 'Arti',
  });
  await db.business.update({ where: { id: berber.id }, data: { instagram: 'berberi.arti', description: 'Berber te Çarshia e Madhe që nga 2014. Qethje klasike dhe moderne.' } });
  await addBookings(berber.id, [
    { day: -7, time: '10:00', service: 0, name: 'Dren Kelmendi', phone: '+38344123456' },
    { day: -7, time: '11:00', service: 1, name: 'Liridon Berisha', phone: '+38349200300' },
    { day: -3, time: '16:00', service: 0, name: 'Blerim Hoti', phone: '+38344555111', status: 'no_show' },
    { day: -1, time: '12:00', service: 2, name: 'Faton Rexha', phone: '+38345100200' },
    { day: 0, time: '09:00', service: 0, name: 'Driton Morina', phone: '+38344700800' },
    { day: 0, time: '09:30', service: 1, name: 'Liridon Berisha', phone: '+38349200300' },
    { day: 0, time: '10:30', service: 2, name: 'Faton Rexha', phone: '+38345100200' },
    { day: 0, time: '12:00', service: 4, name: 'Noli Hoxha' },
    { day: 0, time: '14:00', service: 1, name: 'Genc Shala', phone: '+38349321654' },
    { day: 0, time: '15:30', service: 0, name: 'Dren Kelmendi', phone: '+38344123456', note: 'Vij me djalin' },
    { day: 0, time: '16:30', service: 0, name: 'Arben Thaçi', phone: '+38344909090' },
    { day: 0, time: '17:15', service: 2, name: 'Valon Peci', phone: '+38349878787' },
    { day: 0, time: '18:00', service: 5, name: 'Blerim Hoti', phone: '+38344555111' },
    { day: 1, time: '10:00', service: 0, name: 'Besart Gashi', phone: '+38349112233' },
    { day: 1, time: '11:15', service: 3, name: 'Fisnik Kryeziu', phone: '+38344667788' },
    { day: 2, time: '15:00', service: 1, name: 'Genc Shala', phone: '+38349321654' },
  ]);

  /* 2. Dentist in Prishtina ---------------------------------------------------------- */
  const teuta = await owner('+38344222222', 'Dr. Teuta Krasniqi');
  const dentHours: HoursDoc = defaultHours('dentist');
  dentHours.pause = { on: true, start: '13:00', end: '14:00' };
  const dent = await createBusiness(teuta, {
    name: 'Klinika Dentare Dardania', category: 'dentist', city: 'Prishtinë', slug: 'klinika-dardania', address: 'Rr. Fehmi Agani 24, Dardani',
    services: CATEGORY_PRESETS.dentist.services.map((s) => ({ name: s.name, durationMin: s.durationMin, price: s.priceCents === null ? null : s.priceCents / 100, priceFrom: s.priceFrom })),
    hours: dentHours, ownerName: 'Dr. Teuta',
  });
  await db.business.update({ where: { id: dent.id }, data: { description: 'Klinikë dentare në Dardani. Kontrolle, pastrim, mbushje dhe zbardhim.', minNoticeMin: 120 } });
  await addBookings(dent.id, [
    { day: -2, time: '10:00', service: 0, name: 'Arta Bytyqi', phone: '+38344300400' },
    { day: 0, time: '09:00', service: 1, name: 'Mentor Sadiku', phone: '+38349500600' },
    { day: 0, time: '11:00', service: 0, name: 'Arta Bytyqi', phone: '+38344300400' },
    { day: 0, time: '15:00', service: 2, name: 'Vjosa Limani', phone: '+38345700100' },
    { day: 1, time: '09:30', service: 3, name: 'Kushtrim Aliu', phone: '+38344800900' },
  ]);

  /* 3. Guesthouse in Rugova ------------------------------------------------------------ */
  const besnik = await owner('+38349333333', 'Besnik Lajçi');
  const bujtina = await createBusiness(besnik, {
    name: 'Bujtina Rugova', category: 'bujtine', city: 'Pejë', slug: 'bujtina-rugova', address: 'Fshati Drelaj, Rugovë',
    services: [
      { name: 'Dhomë dyshe (ardhja)', durationMin: 30, price: 45, priceFrom: true, description: 'Nata me mëngjes' },
      { name: 'Kasolle për familje (ardhja)', durationMin: 30, price: 70, description: 'Deri në 5 veta' },
      { name: 'Drekë tradicionale', durationMin: 90, price: 12, description: 'Flija, mish në saç, djathë i Rugovës' },
    ],
    hours: defaultHours('bujtine'), ownerName: 'Besnik',
  });
  await db.business.update({ where: { id: bujtina.id }, data: { description: 'Bujtinë familjare në Rugovë, 25 minuta nga Peja.', slotStepMin: 30, minNoticeMin: 1440, maxAdvanceDays: 60, cancelCutoffMin: 1440 } });
  await addBookings(bujtina.id, [
    { day: 1, time: '13:00', service: 2, name: 'Familja Berisha', phone: '+38344101010' },
    { day: 3, time: '14:00', service: 0, name: 'Anna Müller', phone: '+4915112345678' },
  ]);

  /* Faqja Gati: one live page (linked to the barber's Termini), one waiting in preview --- */
  const livePage = await createPage({
    template: 'berber', name: 'Berberi Arti', city: 'Gjakovë', contactPhone: '+38349111111', userId: arti.id, businessId: berber.id,
    text: 'Berber në Gjakovë, te Çarshia e Madhe, Rr. Ismail Qemali 12. Qethje 5 €, qethje + mjekër 7 €, mjekër 3 €, rruajtje klasike 4 €, qethje për fëmijë 4 €. Hapur 9–20, të shtunën 9–18, të dielën mbyllur. 049 111 111. Punojmë që nga 2014, vetëm me termin, që askush të mos presë.',
  });
  await runGeneration(livePage.id);
  await db.page.update({ where: { id: livePage.id }, data: { subdomain: 'berberi-arti' } });
  await markPaid(livePage.id, { method: 'cash', note: 'Seed', adminUserId: admin.id });

  const previewPage = await createPage({
    template: 'klinike-dentare', name: 'Klinika Dentare Dardania', city: 'Prishtinë', contactPhone: '+38344222222', userId: teuta.id, businessId: dent.id,
    text: 'Klinikë dentare në Prishtinë, Rr. Fehmi Agani 24. Kontroll 10 €, pastrim i dhëmbëve 25 €, mbushje nga 20 €, zbardhim nga 80 €. Hapur 9–18, të shtunën 9–14, të dielën mbyllur. 044 222 222. Parking para klinikës.',
  });
  await runGeneration(previewPage.id);

  console.log(`
Seed done.
  Admin            049 000 000   → /admin
  Berberi Arti     049 111 111   → /b/berberi-arti       (Faqja Gati live: /p/berberi-arti)
  Klinika Dardania 044 222 222   → /b/klinika-dardania   (Faqja Gati preview: /faqja/${previewPage.id})
  Bujtina Rugova   049 333 333   → /b/bujtina-rugova
Log in at /hyr with one of the numbers; the code is shown on the screen in dev.`);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
