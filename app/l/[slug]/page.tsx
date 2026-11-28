// v7 public page of an unclaimed listing: a real business that is not on Termini yet. It never pretends to take
// bookings: "Ende jo në Termini", Call / WhatsApp, "Dua të rezervoj këtu" (demand shown to the business), and
// "Merre falas" for the owner. Not indexed by search engines.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccountBar from '@/components/AccountBar';
import ListingWant from '@/components/ListingWant';
import { Icon, Wordmark } from '@/components/ui';
import { config } from '@/lib/config';
import { listingBySlug } from '@/lib/listings';
import { displayPhone, waDigits } from '@/lib/phone';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
const t = sq.g;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = await listingBySlug((await params).slug);
  return { title: l ? t.listingTitle(l.name, l.city) : sq.booking.notFoundTitle, robots: { index: false, follow: false } };
}

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const l = await listingBySlug((await params).slug);
  if (!l) notFound();
  const support = config.supportWhatsapp();
  return (
    <div className="page page--subtle">
      <AccountBar where="public" />
      <div className="app">
        <header className="topbar"><Link href="/" aria-label="Termini" className="grow"><Wordmark /></Link><Link className="btn btn--ghost btn--sm btn--auto" href="/gjej">{sq.find.title}</Link></header>
        <main className="app__pad stack stack--6" style={{ paddingTop: 16, paddingBottom: 40 }}>
          <section className="stack stack--3">
            <span className="badge badge--new" style={{ alignSelf: 'flex-start' }}>{t.notOnTermini}</span>
            <h1 className="t-h1">{l.name}</h1>
            <p className="t-2">{sq.categories[l.category] || l.category} · {l.city}{l.address ? ` · ${l.address}` : ''}</p>
            <p className="t-small t-2">{t.notOnTerminiText}</p>
            {l.requestsCount > 0 && <p className="t-small"><b>{t.wantCount(l.requestsCount)}</b></p>}
            {l.phone && (
              <div className="cluster">
                <a className="btn btn--secondary btn--auto" href={`tel:${l.phone}`}><Icon name="phone" size="sm" />{t.call} {displayPhone(l.phone)}</a>
                <a className="btn btn--whatsapp btn--auto" href={`https://wa.me/${waDigits(l.phone)}?text=${encodeURIComponent(t.waHello(l.name))}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.whatsapp}</a>
              </div>
            )}
          </section>

          <ListingWant slug={l.slug} />

          <section className="card stack stack--3" aria-labelledby="claim-h">
            <h2 className="t-h2" id="claim-h">{t.claimTitle}</h2>
            <p className="t-2">{t.claimText}</p>
            <p className="t-small">{t.pricing}</p>
            <Link className="btn btn--primary" href={`/fillo?nga=${l.slug}`}>{t.claimCta}</Link>
            <p className="t-caption t-3">{t.claimHint}</p>
          </section>

          <footer className="stack stack--2 t-caption t-3">
            <a className="link" href={`https://wa.me/${support}?text=${encodeURIComponent(t.removeWa(l.name))}`} target="_blank" rel="noopener noreferrer">{t.removeLink}</a>
            {l.source === 'osm' && <span>{t.osmCredit}</span>}
          </footer>
        </main>
      </div>
    </div>
  );
}
