// Demo helper (v5): creates 7 bookings from new numbers at Berberi Arti for tomorrow, so the 7th shows as "to confirm".
// Run: npx tsx scripts/demo-pending.ts
import { createPublicBooking } from '../lib/booking';
import { db } from '../lib/db';
import { addDays, toLocal } from '../lib/time';

async function main() {
  const biz = await db.business.findUniqueOrThrow({ where: { slug: 'berberi-arti' } });
  const svc = (await db.service.findFirst({ where: { businessId: biz.id, active: true, deleted: false }, orderBy: { sort: 'asc' } }))!;
  let date = addDays(toLocal(new Date(), biz.timezone).date, 1);
  if (new Date(date + 'T12:00:00Z').getUTCDay() === 0) date = addDays(date, 1); // skip Sunday
  const times = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'];
  let made = 0;
  for (let i = 0; made < 7 && i < times.length; i++) {
    try {
      const b = await createPublicBooking(biz, { serviceId: svc.id, date, time: times[i], name: `Klient Demo ${i + 1}`, phone: `+38349${Date.now().toString().slice(-5)}${i}` });
      made++;
      console.log(date, times[i], b.status);
    } catch (e) { console.log(date, times[i], 'skip:', (e as Error).message); }
  }
}
main().finally(() => db.$disconnect());
