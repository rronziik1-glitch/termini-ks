// Home (v6): customer-first. Search + the real types of business + the real businesses with their next free time,
// so anyone (no login needed) finds a place and books in a few taps. The pitch for business owners comes after.
import Link from 'next/link';
import AccountBar from '@/components/AccountBar';
import FoundList from '@/components/FoundList';
import ListingList from '@/components/ListingList';
import { findListings } from '@/lib/listings';
import { Icon, Reveal, Wordmark } from '@/components/ui';
import { findBusinesses } from '@/lib/business';
import { db } from '@/lib/db';
import { faqjaGatiOn } from '@/lib/features';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
const t = sq.home;
const SHOW = 6;

export default async function Home() {
  const [{ user, business }, found, kinds, listings] = await Promise.all([
    getSession(),
    findBusinesses(),
    db.business.groupBy({ by: ['category'], where: { listedInFind: true, suspendedAt: null, isDemo: false, onboardedAt: { not: null } }, _count: true }),
    findListings({ take: 6 }),
  ]);
  const appHref = business ? '/app' : user?.role === 'admin' ? '/admin' : '/hyr';
  const cats = kinds.sort((a, b) => b._count - a._count);
  const withFree = found.filter((b) => b.nextDate);
  const list = (withFree.length >= 3 ? withFree : found).slice(0, SHOW);

  return (
    <div className="mk">
      <AccountBar where="public" />
      <Reveal />
      <div className="mk__in">
        <nav className="mk-nav" aria-label={sq.tabs.main}>
          <Link href="/" aria-label="Termini"><Wordmark /></Link>
          <div className="cluster">
            <Link className="btn btn--ghost btn--sm" href="/rezervimet">{sq.my.title}</Link>
            <Link className="btn btn--secondary btn--sm" href={appHref}>{business ? sq.tabs.calendar : t.forBusiness}</Link>
          </div>
        </nav>

        {/* ---- for customers: find and book --------------------------------------------------------- */}
        <header className="mk-find">
          <div className="stack stack--3">
            <h1 className="t-display">{t.findTitle}</h1>
            <p className="t-2 mk-find__lead">{t.findText}</p>
          </div>
          <form className="searchbar searchbar--lg" action="/gjej" method="get" role="search">
            <label className="inputgroup searchbar__field">
              <span className="inputgroup__ad"><Icon name="search" size="sm" /></span>
              <input className="input" type="search" name="q" placeholder={sq.find.searchPh} aria-label={sq.find.searchLabel} autoComplete="off" enterKeyHint="search" maxLength={80} />
            </label>
            <button className="btn btn--primary btn--auto" type="submit">{sq.find.search}</button>
          </form>
          {cats.length > 0 && (
            <nav className="chips chips--wrap" aria-label={t.kinds}>
              {cats.map((c) => (
                <Link key={c.category} className="chip" href={`/gjej?lloji=${c.category}`}>
                  {sq.categoriesShort[c.category] || c.category}<span className="chip__count">{c._count}</span>
                </Link>
              ))}
            </nav>
          )}
        </header>

        <section className="stack stack--4 mk-found" aria-labelledby="free-h">
          <div className="split">
            <h2 className="t-h2" id="free-h">{withFree.length ? t.freeTitle : t.allTitle}</h2>
            {found.length > 0 && <Link className="link t-small" href="/gjej">{t.seeAll(found.length)}</Link>}
          </div>
          {list.length === 0 && listings.length > 0 ? (
            <ListingList list={listings} grid />
          ) : list.length === 0 ? (
            <div className="card empty">
              <p className="empty__title">{sq.find.emptyAll}</p>
              <Link className="btn btn--primary btn--auto" href="/fillo">{sq.find.addYours}</Link>
            </div>
          ) : (
            <>
              <FoundList list={list} grid />
              {found.length > list.length && <Link className="btn btn--secondary" href="/gjej">{t.seeAll(found.length)}<Icon name="chevron-right" size="sm" /></Link>}
              {list.length < SHOW && listings.length > 0 && <><h3 className="t-h3">{sq.g.moreHere}</h3><ListingList list={listings.slice(0, SHOW - list.length)} grid /></>}
            </>
          )}
        </section>
      </div>

      {/* ---- how it works for customers ----------------------------------------------------------------- */}
      <section className="mk-section">
        <div className="mk__in mk-split">
          <div className="stack stack--6 reveal">
            <h2 className="t-display">{t.customersTitle}</h2>
            <p className="t-2" style={{ fontSize: '1.125rem', maxWidth: '30rem' }}>{t.customersText}</p>
            <div><Link className="link" href="/rezervimet">{t.myBookingsLink}</Link></div>
          </div>
          <ul className="mk-list reveal" style={{ ['--i' as string]: 1 }}>
            {[sq.booking.s1, sq.booking.s2, sq.confirmation.sendWa, `${sq.brand.bookedVia} Termini`].map((x) => <li key={x}><Icon name="check" size="sm" /><span>{x}</span></li>)}
          </ul>
        </div>
      </section>

      {/* ---- for business owners ------------------------------------------------------------------------------ */}
      <section className="mk-section mk-section--ink" id="biznese">
        <div className="mk__in">
          <div className="mk-section__head reveal stack stack--4">
            <p className="label-caps" style={{ color: 'rgb(255 255 255 / 0.6)' }}>{t.forBusiness}</p>
            <h2 className="t-display">{t.heroTitle}</h2>
            <p style={{ fontSize: '1.125rem', maxWidth: '34rem', opacity: 0.8 }}>{t.heroText}</p>
            <div className="mk-actions">
              <Link className="btn mk-cta" href={business ? '/app' : '/fillo'}>{business ? sq.onboarding.toCalendar : t.cta}</Link>
              {!user && <Link className="btn btn--secondary" href="/hyr">{t.login}</Link>}
            </div>
            <p className="t-small" style={{ opacity: 0.8 }}>{sq.g.pricing}</p>
          </div>
          <h3 className="t-h2 reveal" style={{ marginTop: 48 }}>{t.stepsTitle}</h3>
          <ol className="mk-steps">
            {t.steps.map((s, i) => (
              <li key={s.n} className="mk-step reveal" style={{ ['--i' as string]: i }}>
                <span className="mk-step__n">{s.n}</span>
                <h3 className="t-h2">{s.title}</h3>
                <p className="t-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {faqjaGatiOn() && <section className="mk-section">
        <div className="mk__in mk-split">
          <div className="stack stack--6 reveal">
            <p className="label-caps">{sq.brand.faqjaGati}</p>
            <h2 className="t-display">{t.pageTitle}</h2>
            <p className="t-2" style={{ fontSize: '1.125rem', maxWidth: '30rem' }}>{t.pageText}</p>
            <div><Link className="btn btn--secondary btn--auto" href="/faqja">{t.pageCta}<Icon name="chevron-right" size="sm" /></Link></div>
          </div>
          <ul className="mk-list reveal" style={{ ['--i' as string]: 1 }}>
            {sq.fg.includes.slice(0, 4).map((x) => <li key={x}><Icon name="check" size="sm" /><span>{x}</span></li>)}
          </ul>
        </div>
      </section>}

      <div className="mk__in">
        <footer className="mk-foot">
          <span><Wordmark small /> · {t.foot}</span>
          <nav aria-label="Termini">
            <Link href="/gjej">{t.find}</Link>
            <Link href="/rezervimet">{sq.my.title}</Link>
            <Link href="/fillo">{t.cta}</Link>
            {faqjaGatiOn() && <Link href="/faqja">{sq.brand.faqjaGati}</Link>}
            <Link href="/hyr">{t.login}</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
