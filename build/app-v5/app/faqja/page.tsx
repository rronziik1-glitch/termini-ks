// Faqja Gati start screen (01-product-design.md §6.1 step 1): headline, example pages, how it works, what 100 € includes.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, Reveal, Wordmark } from '@/components/ui';
import { TEMPLATES } from '@/lib/fg/schema';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.fg.pageTitle, description: sq.fg.description };
const t = sq.fg;

export default function FaqjaStart() {
  return (
    <div className="mk">
      <Reveal />
      <div className="mk__in">
        <nav className="mk-nav" aria-label={sq.tabs.main}>
          <Link href="/" aria-label="Termini" className="cluster" style={{ gap: 8 }}>
            <span className="t-h3">{sq.brand.faqjaGati}</span>
            <span className="t-caption t-3">{t.by} <Wordmark small /></span>
          </Link>
          <Link className="btn btn--primary btn--sm" href="/faqja/krijo">{t.start}</Link>
        </nav>

        <header className="mk-hero" style={{ gridTemplateColumns: '1fr' }}>
          <div className="mk-hero__text">
            <h1 className="t-display">{t.heroTitle}</h1>
            <p>{t.heroText}</p>
            <div className="mk-actions">
              <Link className="btn mk-cta" href="/faqja/krijo">{t.start}</Link>
            </div>
            <p className="t-small t-3">{t.seeFirst}</p>
          </div>
        </header>

        <section className="stack stack--6" style={{ paddingBottom: 'var(--space-18)' }} aria-labelledby="ex-h">
          <div className="stack stack--2 reveal">
            <h2 className="t-h1" id="ex-h">{t.examples}</h2>
            <p className="t-2">{t.examplesText}</p>
          </div>
          <div className="examples">
            {TEMPLATES.map((tpl, i) => (
              <a key={tpl} className="example reveal" style={{ ['--i' as string]: i % 3 }} href={`/faqja/shembull/${tpl}`} target="_blank" rel="noopener" aria-label={t.openExample(t.templates[tpl])}>
                <span className="example__shot">
                  <iframe src={`/faqja/shembull/${tpl}`} title={t.templates[tpl]} loading="lazy" tabIndex={-1} aria-hidden="true" />
                </span>
                <span className="example__name">{t.templates[tpl]}</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      <section className="mk-section mk-section--ink">
        <div className="mk__in">
          <div className="mk-section__head reveal"><h2 className="t-display">{t.how}</h2></div>
          <ol className="mk-steps">
            {t.howSteps.map((s, i) => (
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
            <h2 className="t-display">{t.includesTitle}</h2>
            <div><Link className="btn btn--primary btn--auto" href="/faqja/krijo">{t.start}<Icon name="chevron-right" size="sm" /></Link></div>
          </div>
          <ul className="mk-list reveal" style={{ ['--i' as string]: 1 }}>
            {t.includes.map((x) => <li key={x}><Icon name="check" size="sm" /><span>{x}</span></li>)}
          </ul>
        </div>
      </section>

      <div className="mk__in">
        <footer className="mk-foot">
          <span>{sq.brand.faqjaGati} · {sq.home.foot}</span>
          <nav aria-label={sq.brand.faqjaGati}>
            <Link href="/">{sq.brand.termini}</Link>
            <Link href="/fillo">{sq.home.cta}</Link>
            <Link href="/gjej">{sq.home.find}</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
