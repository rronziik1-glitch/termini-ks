// Audit check: Albanian WhatsApp texts for a booking 5 days ahead. Run from build/app: npx tsx ../../fable/_audit/wa-check.ts
import { ownerMessage } from '../../build/app/lib/booking';
import { localToUtc, addDays, toLocal } from '../../build/app/lib/time';

const date = addDays(toLocal(new Date()).date, 5);
const startsAt = localToUtc(date, '10:30');
const b = {
  id: 'x', token: 'TOKEN', serviceName: 'Qethje', startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60e3),
  business: { name: 'Berberi Arti', slug: 'berberi-arti', timezone: 'Europe/Belgrade', phone: '+38349111111', whatsapp: '' },
  customer: { name: 'Driton Morina', phone: '+38344123456' },
} as never;
for (const t of ['reminder', 'cancel', 'confirm', 'noshow']) console.log(`--- ${t}\n${ownerMessage(b, t, 'https://termini.app')?.text}`);
