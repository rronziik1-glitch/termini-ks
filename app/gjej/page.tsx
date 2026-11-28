// "Gjej": businesses by city and category, sorted by the soonest free time (01-product-design.md §3.6).
import type { Metadata } from 'next';
import AccountBar from '@/components/AccountBar';
import FoundList from '@/components/FoundList';
import ListingList from '@/components/ListingList';
import { findListings } from '@/lib/listings';
import Link from 'next/link';
import { Icon, Wordmark } from '@/components/ui';
import { findBusinesses } from '@/lib/business';
import { db } from '@/lib/db';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.find.pageTitle, description: sq.find.text };
const t = sq.find;
const CATS = ['berber', 'salon', 'dentist', 'klinike', 'bujtine', 'dasma', 'autoshkolla', 'lavazh', 'tjeter'];

export default async function FindPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const used = (await db.business.findMany({ where: { listedInFind: true, suspendedAt: null, isDemo: false }, select: { city: true }, distinct: ['city'] })).map((b) => b.city);
  const cities = [...sq.cities.filter((c) => c !== sq.common.other), ...used.filter((c) => !sq.cities.includes(c))];
  const city = typeof q.qyteti === 'string' && cities.includes(q.qyteti) ? q.qyteti : '';
  const category = typeof q.lloji === 'string' && CATS.includes(q.lloji) ? q.lloji : '';
  const search = typeof q.q === 'string' ? q.q.trim().slice(0, 80) : '';
  const [list, listings] = await Promise.all([
    findBusinesses(city || undefined, category || undefined, undefined, search),
    findListings({ city: city || undefined, category: category || undefined, q: search }),
  ]);
  const href = (c: string, k: string, s0 = search) => { const p = new URLSearchParams(); if (s0) p.set('q', s0); if (c) p.set('qyteti', c); if (k) p.set('lloji', k); const s = p.toString(); return s ? `/gjej?${s}` : '/gjej'; };

  return (
    <div className="page page--subtle">
      <AccountBar where="public" />
      <div className="app">
        <header className="topbar"><Link href="/" aria-label="Termini" className="grow"><Wordmark /></Link><Link className="btn btn--ghost btn--sm btn--auto" href="/hyr">{sq.home.login}</Link></header>
        <main className="app__pad stack stack--6" style={{ paddingTop: 16, paddingBottom: 40 }}>
          <div className="stack stack--2">
            <h1 className="t-h1">{t.title}</h1>
            <p className="t-2">{t.text}</p>
          </div>

          {/* v6 global search: a normal GET form, works without JavaScript; city and type stay as chosen */}
          <form className="searchbar" action="/gjej" method="get" role="search">
            <label className="inputgroup searchbar__field">
              <span className="inputgroup__ad"><Icon name="search" size="sm" /></span>
              <input className="input" type="search" name="q" defaultValue={search} placeholder={t.searchPh} aria-label={t.searchLabel} autoComplete="off" enterKeyHint="search" maxLength={80} />
              {search && <Link className="searchbar__clear" href={href(city, category, '')} aria-label={t.clear}><Icon name="x" size="sm" /></Link>}
            </label>
            {city && <input type="hidden" name="qyteti" value={city} />}
            {category && <input type="hidden" name="lloji" value={category} />}
            <button className="btn btn--primary btn--auto" type="submit">{t.search}</button>
          </form>

          <div className="stack stack--3">
            <p className="label-caps">{t.city}</p>
            <div className="chips chips--wide">
              <Link className={`chip${!city ? ' is-selected' : ''}`} href={href('', category)} aria-current={!city ? 'true' : undefined}>{t.all}</Link>
              {cities.map((c) => <Link key={c} className={`chip${city === c ? ' is-selected' : ''}`} href={href(c, category)} aria-current={city === c ? 'true' : undefined}>{c}</Link>)}
            </div>
            <div className="chips chips--wide">
              <Link className={`chip${!category ? ' is-selected' : ''}`} href={href(city, '')} aria-current={!category ? 'true' : undefined}>{t.all}</Link>
              {CATS.map((c) => <Link key={c} className={`chip${category === c ? ' is-selected' : ''}`} href={href(city, c)} aria-current={category === c ? 'true' : undefined}>{sq.categoriesShort[c]}</Link>)}
            </div>
          </div>

          {search && list.length > 0 && <p className="t-small t-2" aria-live="polite">{t.results(list.length, search)}</p>}
          {list.length === 0 && listings.length > 0 ? null : list.length === 0 ? (
            search ? (
              <section className="card empty" aria-live="polite">
                <p className="empty__title">{t.noResults(search)}</p>
                <p className="t-small t-2">{t.noResultsHint}</p>
                <Link className="btn btn--primary" href="/gjej">{t.showAll}</Link>
              </section>
            ) : (
              <section className="card empty">
                <p className="empty__title">{city ? sq.g.soonCity(city) : t.emptyAll}</p>
                {city && <p className="t-small t-2">{sq.g.soonCityText}</p>}
                <Link className="btn btn--primary" href="/fillo">{t.addYours}</Link>
              </section>
            )
          ) : (
            <FoundList list={list} />
          )}

          {listings.length > 0 && (
            <section className="stack stack--3" aria-labelledby="more-h">
              {list.length > 0 && <h2 className="t-h3" id="more-h">{sq.g.moreHere}</h2>}
              <ListingList list={listings} />
            </section>
          )}

          {(list.length > 0 || listings.length > 0) && <p className="t-small t-3 t-center">{sq.brand.haveBusiness} <Link className="link" href="/fillo">{sq.brand.getLink}</Link></p>}
        </main>
      </div>
    </div>
  );
}
