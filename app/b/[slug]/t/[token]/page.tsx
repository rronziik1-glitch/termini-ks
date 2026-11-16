// Booking confirmation and the customer's permanent view of the booking (01-product-design.md §3.2).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CancelBooking from '@/components/CancelBooking';
import { Icon, SuccessMark, Wordmark } from '@/components/ui';
import { customerConfirmLink, displayStatus, getByToken } from '@/lib/booking';
import { mapsUrl } from '@/lib/links';
import { displayPhone } from '@/lib/phone';
import { getOrigin } from '@/lib/session';
import { sq } from '@/lib/sq';
import { dayAcc, fmtDateLong, fmtDateRel, fmtDayMonth, fmtDuration, fmtPrice, toLocal } from '@/lib/time';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string; token: string }> };
const t = sq.confirmation;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getByToken((await params).token);
  return { title: b ? (b.status === 'pending' ? `${t.pendingTitle} · ${b.business.name}` : t.pageTitle(b.business.name)) : sq.booking.notFoundTitle, robots: { index: false, follow: false } };
}

export default async function ConfirmationPage({ params }: Props) {
  const { slug, token } = await params;
  const b = await getByToken(token);
  if (!b || b.business.slug !== slug) notFound();
  const biz = b.business;
  const now = new Date();
  const status = displayStatus(b, now);
  const l = toLocal(b.startsAt, biz.timezone);
  const today = toLocal(now, biz.timezone).date;
  const rel = fmtDateRel(l.date, today);
  const whenAcc = rel === 'sot' || rel === 'nesër' ? rel : dayAcc(l.date);
  const duration = Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000);
  const tooLate = b.startsAt.getTime() - now.getTime() < biz.cancelCutoffMin * 60000;
  const confirmed = status === 'confirmed';
  const pending = status === 'pending';
  const cancelled = status === 'cancelled_customer' || status === 'cancelled_business';
  const bookAgain = `/b/${biz.slug}`;

  return (
    <div className="page">
      <div className="app">
        <main className="app__pad stack stack--6" style={{ paddingTop: 56 }}>
          {confirmed && (
            <div className="stack">
              <SuccessMark />
              <h1 className="t-display fade-up" style={{ ['--i' as string]: 0 }}>{t.title}</h1>
              <p className="t-2 fade-up" style={{ ['--i' as string]: 1 }}>{t.text(whenAcc, l.time)}</p>
            </div>
          )}
          {pending && (
            <div className="stack">
              <span className="badge badge--new" style={{ alignSelf: 'flex-start' }}>{t.pendingBadge}</span>
              <h1 className="t-display fade-up" style={{ ['--i' as string]: 0 }}>{t.pendingTitle}</h1>
              <p className="t-2 fade-up" style={{ ['--i' as string]: 1 }}>{t.pendingText(biz.name)}</p>
            </div>
          )}
          {status === 'expired' && (
            <div className="stack">
              <span className="badge badge--danger" style={{ alignSelf: 'flex-start' }}>{t.expiredBadge}</span>
              <h1 className="t-display">{t.expiredTitle}</h1>
              <p className="t-2">{t.expiredText(biz.name)}</p>
            </div>
          )}
          {cancelled && (
            <div className="stack">
              <span className="badge badge--danger" style={{ alignSelf: 'flex-start' }}>{t.cancelledBadge}</span>
              <h1 className="t-display">{t.cancelledTitle}</h1>
              <p className="t-2">{status === 'cancelled_business' ? t.cancelledByBiz(biz.name) : t.cancelledText(biz.name)}</p>
            </div>
          )}
          {(status === 'completed' || status === 'no_show') && (
            <div className="stack">
              <span className={`badge ${status === 'no_show' ? 'badge--danger' : 'badge--ok'}`} style={{ alignSelf: 'flex-start' }}>{status === 'no_show' ? t.noShowBadge : t.doneBadge}</span>
              <h1 className="t-display">{t.doneTitle}</h1>
              {status === 'completed' && <p className="t-2">{t.doneText}</p>}
            </div>
          )}

          <dl className={`card summary${confirmed ? ' fade-up' : ''}`} style={{ ['--i' as string]: 2 }}>
            <div className="summary__row"><dt>{t.service}</dt><dd>{b.serviceName} · {fmtDuration(duration)}</dd></div>
            <div className="summary__row"><dt>{t.when}</dt><dd><time dateTime={b.startsAt.toISOString()}>{fmtDateLong(l.date)} · {l.time}</time></dd></div>
            <div className="summary__row"><dt>{t.where}</dt><dd>{biz.name}<br /><span className="t-small t-2">{[biz.address, biz.city].filter(Boolean).join(', ')}</span></dd></div>
            <div className="summary__row"><dt>{t.price}</dt><dd>{b.priceCents === null ? sq.common.priceOnSite : <>{fmtPrice(b.priceCents)} <span className="t-small t-2">{t.payOnSite}</span></>}</dd></div>
          </dl>

          {confirmed ? (
            <>
              <div className="stack stack--2 fade-up" style={{ ['--i' as string]: 3 }}>
                <a className="btn btn--whatsapp" href={customerConfirmLink(b, await getOrigin())} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.sendWa}</a>
                <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                  <a className="btn btn--secondary" href={`/api/public/bookings/${b.token}/calendar.ics`}><Icon name="calendar-plus" size="sm" />{t.addCal}</a>
                  <a className="btn btn--secondary" href={mapsUrl(biz)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size="sm" />{t.directions}</a>
                </div>
              </div>
              <div className="t-center fade-up" style={{ ['--i' as string]: 4 }}>
                <CancelBooking token={b.token}
                  sureText={t.sureText(b.serviceName, dayAcc(l.date), fmtDayMonth(l.date), l.time)}
                  tooLateText={tooLate ? sq.errors.too_late(fmtDuration(biz.cancelCutoffMin), displayPhone(biz.phone)) : ''}
                  tel={biz.phone} />
              </div>
            </>
          ) : pending ? (
            <div className="stack stack--2">
              <a className="btn btn--whatsapp" href={customerConfirmLink(b, await getOrigin())} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.pendingWa}</a>
              <div className="t-center">
                <CancelBooking token={b.token}
                  sureText={t.sureText(b.serviceName, dayAcc(l.date), fmtDayMonth(l.date), l.time)}
                  tooLateText={tooLate ? sq.errors.too_late(fmtDuration(biz.cancelCutoffMin), displayPhone(biz.phone)) : ''}
                  tel={biz.phone} />
              </div>
            </div>
          ) : (
            <Link className="btn btn--primary" href={bookAgain}>{t.rebook}</Link>
          )}
        </main>

        <footer className="footnote mt-auto stack stack--2" style={{ alignItems: 'center' }}>
          <p>{sq.brand.bookedVia} <Link href="/"><Wordmark small /></Link></p>
          <p>{sq.brand.haveBusiness} <Link className="link" href="/fillo">{sq.brand.getLink}</Link></p>
        </footer>
      </div>
    </div>
  );
}
