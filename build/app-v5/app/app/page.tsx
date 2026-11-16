import type { Metadata } from 'next';
import Calendar from '@/components/Calendar';
import { bookingUrl, displayLink } from '@/lib/config';
import { getOrigin, getSession } from '@/lib/session';
import { sq } from '@/lib/sq';
import { toLocal } from '@/lib/time';

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getSession();
  return { title: sq.calendar.pageTitle(business?.name || 'Termini') };
}

export default async function CalendarPage() {
  const [{ business }, origin] = await Promise.all([getSession(), getOrigin()]);
  const b = business!;                                             // the layout redirects when there is none
  const link = displayLink(b.slug, origin);
  return (
    <Calendar
      biz={{ name: b.name, slug: b.slug, hasPhoto: !!b.photoUrl, slotStepMin: b.slotStepMin, maxAdvanceDays: b.maxAdvanceDays }}
      link={{ url: bookingUrl(b.slug, origin), shown: link.prefix + link.slug }}
      today={toLocal(new Date(), b.timezone).date}
    />
  );
}
