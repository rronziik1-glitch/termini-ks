// Customer booking page (01-product-design.md §3.1). Profile and services are rendered on the server;
// free times are fetched by the client component.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BookingFlow from '@/components/BookingFlow';
import { loadCtx, openState } from '@/lib/availability';
import { waLink } from '@/lib/booking';
import { db } from '@/lib/db';
import { mapsUrl } from '@/lib/links';
import { displayPhone } from '@/lib/phone';
import { sq } from '@/lib/sq';
import { fmtDuration, fmtPrice, isDate, toLocal } from '@/lib/time';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const load = (slug: string) => db.business.findUnique({
  where: { slug },
  include: { services: { where: { active: true, deleted: false }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }, staff: { where: { active: true }, orderBy: { sort: 'asc' } } },
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await db.business.findUnique({ where: { slug: (await params).slug }, select: { name: true, description: true, city: true } });
  if (!b) return { title: sq.booking.notFoundTitle };
  return { title: sq.booking.pageTitle(b.name), description: b.description || `${b.name}, ${b.city}. ${sq.brand.tagCustomers}` };
}

export default async function BookingPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const b = await load(slug);
  if (!b || b.suspendedAt) notFound();
  const now = new Date();
  const today = toLocal(now, b.timezone).date;
  const state = openState(await loadCtx(b, today, 8), now);
  const openText = state.open ? sq.booking.openUntil(state.until!) : state.opensAt ? sq.booking.closedOpens(state.opensWhen!, state.opensAt) : sq.booking.closedNow;
  const from = query.nga === 'faqja' ? 'page' : query.nga === 'gjej' ? 'find' : 'link';
  const phone = displayPhone(b.phone);

  return (
    <BookingFlow
      biz={{
        slug: b.slug, name: b.name, meta: `${sq.categories[b.category] || sq.common.other} · ${b.city}`, address: b.address, mapsUrl: mapsUrl(b),
        tel: b.phone, phoneDisplay: phone, photoUrl: b.photoUrl, open: state.open, openText,
        paused: b.bookingsPaused, approval: b.requireApproval, pausedText: sq.errors.paused(b.name, phone), waFull: waLink(b.whatsapp || b.phone, sq.wa.fullBusiness),
      }}
      services={b.services.map((s) => ({
        id: s.id, name: s.name, meta: [fmtDuration(s.durationMin), s.description].filter(Boolean).join(' · '),
        price: s.priceCents === null ? '' : fmtPrice(s.priceCents, s.priceFrom),
      }))}
      staff={b.staff.length > 1 ? b.staff.map((s) => ({ id: s.id, name: s.name })) : []}
      today={today}
      source={from}
      initialDate={isDate(query.dita) ? query.dita : null}
    />
  );
}
