// "Gjej": businesses by city and category, sorted by the soonest free time (01-product-design.md §3.6).
import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/ui';
import { findBusinesses } from '@/lib/business';
import { db } from '@/lib/db';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, diffDays, fmtDayMonth, fmtPrice, toLocal, weekdayOf } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.find.pageTitle, description: sq.find.text };
const t = sq.find;
const CATS = ['berber', 'salon', 'dentist', 'klinike', 'bujtine', 'tjeter'];

export default async function FindPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const used = (await db.business.findMany({ where: { listedInFind: true }, select: { city: true }, distinct: ['city'] })).map((b) => b.city);
  const cities = [...sq.cities.filter((c) => c !== sq.common.other), ...used.filter((c) => !sq.cities.includes(c))];
  const city = typeof q.qyteti === 'string' && cities.includes(q.qyteti) ? q.qyteti : '';
  const category = typeof q.lloji === 'string' && CATS.includes(q.lloji) ? q.lloji : '';
  const list = await findBusinesses(city || undefined, category || undefined);
  const today = toLocal(new Date()).date;
  const href = (c: string, k: string) => { const p = new URLSearchParams(); if (c) p.set('qyteti', c); if (k) p.set('lloji', k); const s = p.toString(); return s ? `/gjej?${s}` : '/gjej'; };
  const whenLabel = (date: string) => { const n = diffDays(today, date); return n === 0 ? sq.common.today : n === 1 ? sq.common.tomorrow : `${DAYS_SHORT[weekdayOf(date) - 1]} ${fmtDayMonth(date)}`; };

  return (
    <div className="page page--subtle">
      <div className="app">
        <header className="topbar"><Link href="/" aria-label="Termini" className="grow"><Wordmark /></Link><Link className="btn btn--ghost btn--sm btn--auto" href="/hyr">{sq.home.login}</Link></header>
        <main className="app__pad stack stack--6" style={{ paddingTop: 16, paddingBottom: 40 }}>
          <div className="stack stack--2">
            <h1 className="t-h1">{t.title}</h1>
            <p className="t-2">{t.text}</p>
          </div>

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

          {list.length === 0 ? (
            <section className="card empty">
              <p className="empty__title">{city ? t.empty(city) : t.emptyAll}</p>
              <Link className="btn btn--primary" href="/fillo">{t.addYours}</Link>
            </section>
          ) : (
            <ul className="stack stack--3">
              {list.map((b) => (
                <li key={b.slug}>
                  <Link className="found" href={`/b/${b.slug}?nga=gjej${b.nextDate ? `&dita=${b.nextDate}` : ''}`}>
                    <span className="avatar avatar--lg avatar--ink" aria-hidden="true">{b.photoUrl ? <img src={b.photoUrl} alt="" /> : b.name.charAt(0).toUpperCase()}</span>
                    <span className="row__main">
                      <span className="row__title">{b.name}</span>
                      <span className="row__meta">{sq.categoriesShort[b.category] || sq.common.other} · {b.city}{b.priceFromCents !== null ? ` · ${fmtPrice(b.priceFromCents, true)}` : ''}</span>
                    </span>
                    <span className="found__next">
                      {b.nextDate ? <><span>{t.nextFree}</span><b>{whenLabel(b.nextDate)} {b.nextTime}</b></> : <span>{b.paused ? t.paused : t.noFree}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {list.length > 0 && <p className="t-small t-3 t-center">{sq.brand.haveBusiness} <Link className="link" href="/fillo">{sq.brand.getLink}</Link></p>}
        </main>
      </div>
    </div>
  );
}
