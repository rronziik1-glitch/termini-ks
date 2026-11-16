// Marketing home (02-design-system.md §8): white and ink sections, lime once, on the main call to action.
import Link from 'next/link';
import { faqjaGatiOn } from '@/lib/features';
import { Icon, Reveal, Wordmark } from '@/components/ui';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
const t = sq.home;

/** A real piece of the booking UI inside a phone frame. */
function PhoneDemo() {
  // Audit S6: dates come from today so the demo never looks stale (Sundays skipped, like a barber).
  const DOW = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
  const days: [string, string, boolean][] = [];
  for (let i = 0, d = new Date(); days.length < 5; i++, d = new Date(Date.now() + i * 864e5)) {
    if (d.getDay() === 0) continue;
    days.push([i === 0 ? 'Sot' : i === 1 ? 'Nesër' : DOW[d.getDay()], String(d.getDate()), days.length === 1]);
  }
  const slots = ['09:00', '09:30', '10:15', '13:30', '15:30', '16:00'];
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone__screen">
        <div className="split" style={{ justifyContent: 'flex-start' }}>
          <span className="avatar avatar--ink">A</span>
          <div><p className="t-h3">Berberi Arti</p><p className="t-caption t-3">Berber · Gjakovë</p></div>
        </div>
        <p className="t-h2">{sq.booking.s2}</p>
        <div className="days">
          {days.map(([dow, num, on]) => <span key={num} className={`day${on ? ' is-selected' : ''}`}><span className="day__dow">{dow}</span><span className="day__num">{num}</span></span>)}
        </div>
        <div className="slots">
          {slots.map((s) => <span key={s} className={`slot${s === '15:30' ? ' is-selected' : ''}`} style={{ display: 'grid', placeItems: 'center' }}>{s}</span>)}
        </div>
        <span className="btn btn--primary">{sq.booking.confirm}</span>
      </div>
    </div>
  );
}

export default async function Home() {
  const { user, business } = await getSession();
  const appHref = business ? '/app' : user?.role === 'admin' ? '/admin' : '/hyr';
  return (
    <div className="mk">
      <Reveal />
      <div className="mk__in">
        <nav className="mk-nav" aria-label={sq.tabs.main}>
          <Link href="/" aria-label="Termini"><Wordmark /></Link>
          <div className="cluster">
            <Link className="btn btn--ghost btn--sm" href="/gjej">{t.find}</Link>
            <Link className="btn btn--secondary btn--sm" href={appHref}>{business ? sq.tabs.calendar : t.login}</Link>
          </div>
        </nav>

        <header className="mk-hero">
          <div className="mk-hero__text">
            <h1 className="t-display">{t.heroTitle}</h1>
            <p>{t.heroText}</p>
            <div className="mk-actions">
              <Link className="btn mk-cta" href={business ? '/app' : '/fillo'}>{business ? sq.onboarding.toCalendar : t.cta}</Link>
              <Link className="btn btn--secondary" href="/gjej">{t.find}</Link>
            </div>
          </div>
          <PhoneDemo />
        </header>
      </div>

      <section className="mk-section mk-section--ink">
        <div className="mk__in">
          <div className="mk-section__head reveal"><h2 className="t-display">{t.stepsTitle}</h2></div>
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

      <section className="mk-section">
        <div className="mk__in mk-split">
          <div className="stack stack--6 reveal">
            <h2 className="t-display">{t.customersTitle}</h2>
            <p className="t-2" style={{ fontSize: '1.125rem', maxWidth: '30rem' }}>{t.customersText}</p>
            <div><Link className="btn btn--primary btn--auto" href="/gjej">{t.find}<Icon name="chevron-right" size="sm" /></Link></div>
          </div>
          <ul className="mk-list reveal" style={{ ['--i' as string]: 1 }}>
            {[sq.booking.s1, sq.booking.s2, sq.confirmation.sendWa, `${sq.brand.bookedVia} Termini`].map((x) => <li key={x}><Icon name="check" size="sm" /><span>{x}</span></li>)}
          </ul>
        </div>
      </section>

      {faqjaGatiOn() && <section className="mk-section mk-section--ink">
        <div className="mk__in mk-split">
          <div className="stack stack--6 reveal">
            <p className="label-caps" style={{ color: 'rgb(255 255 255 / 0.6)' }}>{sq.brand.faqjaGati}</p>
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
            <Link href="/fillo">{t.cta}</Link>
            <Link href="/gjej">{t.find}</Link>
            {faqjaGatiOn() && <Link href="/faqja">{sq.brand.faqjaGati}</Link>}
            <Link href="/hyr">{t.login}</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
