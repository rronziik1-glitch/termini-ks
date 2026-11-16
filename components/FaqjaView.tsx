'use client';
// /faqja/{id} (01-product-design.md §6.1 steps 5–8). One component, one view per page status:
//   generating → four named stages (polls /api/pages/{id}/status, then reloads the server data)
//   preview    → watermarked page in a phone frame + "Merre për 100 €", "Ndrysho diçka", "Provo stil tjetër"
//   pay        → what 100 € includes, address, payment method
//   payment_pending → bank details / cash / Paysera waiting screen
//   paid / live → published (or about to be)
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ApiError, Field, Icon, Sheet, SuccessMark, api, copyText, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';

const t = sq.fg;
const STAGES = ['read', 'write', 'photos', 'build'];
const VARIANTS = ['', 'a', 'b', 'c'];
const TEMPLATE_CATEGORY: Record<string, string> = { berber: 'berber', 'salon-bukurie': 'salon', 'klinike-dentare': 'dentist', bujtine: 'bujtine', 'sallon-dasmash': 'dasma', autoshkolla: 'autoshkolla', 'lavazh-servis': 'lavazh' };

type PageData = {
  id: string; status: string; name: string; city: string; template: string; text: string; themeVariant: string; revisionsLeft: number; notice: string;
  subdomain: string; customDomain: string; updatedAt: number; liveUrl: string; termini: string; loggedInBusiness: boolean;
};
type Payment = { method: string; reference: string; amountCents: number } | null;
type Settings = {
  priceCents: number; domainCents: number; payseraOn: boolean; bank: { iban: string; name: string; holder: string };
  supportWa: string; supportName: string; hostSuffix: string;
};

const eur = (cents: number) => `${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} €`;
const wa = (digits: string, text: string) => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
const slugish = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ë/g, 'e').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function FaqjaView({ page, payment, settings, initialStep }: { page: PageData; payment: Payment; settings: Settings; initialStep: '' | 'pay' }) {
  const router = useRouter();
  const [status, setStatus] = useState(page.status);
  const [stage, setStage] = useState('read');
  const [step, setStep] = useState<'' | 'pay'>(initialStep);
  const [frameV, setFrameV] = useState(page.updatedAt);
  const [variant, setVariant] = useState(page.themeVariant);
  const [sheet, setSheet] = useState<'' | 'change'>('');
  const [note, setNote] = useState('');
  const [about, setAbout] = useState(page.text);
  const [busy, setBusy] = useState(false);
  const [paidClicked, setPaidClicked] = useState(false);
  // payment form
  const [addr, setAddr] = useState<'free' | 'own'>(page.customDomain ? 'own' : 'free');
  const [sub, setSub] = useState(page.subdomain || slugish(page.name));
  const [own, setOwn] = useState(page.customDomain);
  const [method, setMethod] = useState(payment?.method || '');
  const [payErr, setPayErr] = useState('');
  const polling = useRef(false);

  // New server data (after router.refresh) replaces the local copy.
  useEffect(() => { setStatus(page.status); setFrameV(page.updatedAt); setVariant(page.themeVariant); setAbout(page.text); }, [page.status, page.updatedAt, page.themeVariant, page.text]);

  /* ---- progress polling ---- */
  useEffect(() => {
    if (status !== 'generating' || polling.current) return;
    polling.current = true;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api<{ status: string; stage: string }>(`/pages/${page.id}/status`);
        if (!alive) return;
        if (r.stage) setStage(r.stage);
        if (r.status !== 'generating') { polling.current = false; router.refresh(); return; }
      } catch { /* keep trying; the network may come back */ }
      if (alive) setTimeout(tick, 1100);
    };
    tick();
    return () => { alive = false; polling.current = false; };
  }, [status, page.id, router]);

  async function generate(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await api<{ status: string; updatedAt: number; themeVariant: string }>(`/pages/${page.id}/generate`, { body });
      setSheet(''); setNote('');
      if (r.status === 'generating') { setStage('read'); setStatus('generating'); }
      else { setVariant(r.themeVariant); setFrameV(r.updatedAt); toast(t.styleChanged); }
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  const nextStyle = () => generate({ theme_variant: VARIANTS[(VARIANTS.indexOf(variant) + 1) % VARIANTS.length] });

  async function checkout() {
    if (!method) { setPayErr(t.pickMethod); return; }
    setPayErr(''); setBusy(true);
    try {
      const r = await api<{ redirectUrl: string }>(`/pages/${page.id}/checkout`, { body: { method, subdomain: addr === 'free' ? sub : '', custom_domain: addr === 'own' ? own : '' } });
      if (r.redirectUrl) { window.location.href = r.redirectUrl; return; }
      setStep(''); setStatus('payment_pending'); router.refresh();
    } catch (e) {
      setPayErr(e instanceof ApiError ? e.message : sq.common.failed);
    }
    setBusy(false);
  }

  const supportLink = wa(settings.supportWa, sq.wa.supportPage(page.id.slice(0, 6).toUpperCase()));
  const total = settings.priceCents + (addr === 'own' && own.trim() ? settings.domainCents : 0);

  /* ================================================================== generating */
  if (status === 'generating' || status === 'draft') {
    const i = Math.max(0, STAGES.indexOf(stage));
    return (
      <div className="page"><div className="app"><main className="app__pad">
        <div className="stack stack--8" style={{ paddingTop: 48, paddingBottom: 40 }}>
          <div className="stack stack--2">
            <h1 className="t-h1">{t.building}</h1>
            <p className="t-2">{t.buildingText}</p>
          </div>
          <ol className="stages" aria-live="polite">
            {STAGES.map((s, n) => (
              <li key={s} className={`stage${n < i ? ' is-done' : n === i ? ' is-active' : ''}`}>
                <span className="stage__dot"><Icon name="check" size="xs" /></span>{t.stages[s]}
              </li>
            ))}
          </ol>
          <div className="skeleton buildframe" aria-hidden="true" />
        </div>
      </main></div></div>
    );
  }

  /* ================================================================== failed / expired */
  if (status === 'failed' || status === 'expired') {
    const failed = status === 'failed';
    return (
      <div className="page"><div className="app"><main className="app__pad">
        <section className="card empty" style={{ marginTop: 48 }}>
          <p className="empty__title">{failed ? t.failed : t.expiredTitle}</p>
          <p className="empty__text">{failed ? t.failedFinal : t.expiredText}</p>
          <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={() => generate({})}>{failed ? t.retry : t.rebuild}</button>
          <a className="btn btn--ghost" href={supportLink} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.writeUs}</a>
        </section>
      </main></div></div>
    );
  }

  /* ================================================================== live / paid */
  if (status === 'live' || status === 'paid') {
    const live = status === 'live';
    const fillo = `/fillo?emri=${encodeURIComponent(page.name)}&qyteti=${encodeURIComponent(page.city)}&lloji=${TEMPLATE_CATEGORY[page.template] || 'tjeter'}`;
    return (
      <div className="page"><div className="app"><main className="app__pad">
        <div className="stack stack--6" style={{ paddingTop: 56, paddingBottom: 40 }}>
          <SuccessMark />
          <div className="stack stack--2">
            <h1 className="t-display">{live ? t.liveTitle : t.pendingTitle}</h1>
            <p className="t-2">{live ? t.liveText : t.unpublished}</p>
          </div>
          {live && page.liveUrl && (
            <>
              <div className="linkbox"><p className="linkbox__url">{page.liveUrl.replace(/^https?:\/\//, '')}</p>
                {page.customDomain && <p className="t-caption" style={{ opacity: 0.6, marginTop: 8 }}>{page.customDomain} · {t.addressOwn}</p>}
              </div>
              <div className="stack stack--2">
                <a className="btn btn--primary" href={page.liveUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size="sm" />{t.openPage}</a>
                <a className="btn btn--whatsapp" href={`https://wa.me/?text=${encodeURIComponent(sq.wa.pageLive(page.liveUrl))}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.shareWa}</a>
                <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                  <button className="btn btn--secondary" onClick={() => copyText(page.liveUrl)}><Icon name="copy" size="sm" />{t.copyLink}</button>
                  <button className="btn btn--secondary" onClick={() => copyText(page.liveUrl, t.putInBio)}><Icon name="copy" size="sm" />{t.putInBio}</button>
                </div>
              </div>
              {page.termini ? (
                <p className="note"><Icon name="check" size="sm" /> {t.terminiOn}</p>
              ) : (
                <a className="banner" href={page.loggedInBusiness ? '/app/cilesimet' : fillo}>
                  <Icon name="calendar" />
                  <span className="banner__text"><b>{t.terminiOff}</b><span>{t.terminiOffText}</span></span>
                  <Icon name="chevron-right" />
                </a>
              )}
            </>
          )}
          <a className="btn btn--ghost" href={supportLink} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.writeUs}</a>
        </div>
      </main></div></div>
    );
  }

  /* ================================================================== payment step */
  if (step === 'pay') {
    return (
      <div className="page page--subtle">
        <div className="app app--bar">
          <header className="topbar">
            <button className="iconbtn" onClick={() => setStep('')} aria-label={sq.common.back}><Icon name="chevron-left" /></button>
            <h1 className="topbar__title">{t.payTitle}</h1>
          </header>
          <main className="app__pad stack stack--6" style={{ paddingTop: 8, paddingBottom: 24 }}>
            <section className="group">
              <h2 className="label-caps group__label">{t.payIncludes}</h2>
              <ul className="card mk-list">
                {t.includes.map((x) => <li key={x}><Icon name="check" size="sm" /><span className="t-small">{x}</span></li>)}
              </ul>
            </section>

            <section className="group">
              <h2 className="label-caps group__label">{t.address}</h2>
              <div className="stack stack--2">
                <button type="button" className={`method${addr === 'free' ? ' is-selected' : ''}`} aria-pressed={addr === 'free'} onClick={() => setAddr('free')}>
                  <span className="method__radio" />
                  <span className="row__main"><span className="row__title row__title--plain t-num">{(sub || 'emri') + settings.hostSuffix}</span></span>
                  <span className="badge badge--ok">{t.addressFree}</span>
                </button>
                {addr === 'free' && (
                  <label className="inputgroup">
                    <span className="sr">{t.address}</span>
                    <input className="input" autoCapitalize="none" value={sub} maxLength={40} onChange={(e) => setSub(slugish(e.target.value))} />
                    <span className="inputgroup__ad inputgroup__ad--end">{settings.hostSuffix}</span>
                  </label>
                )}
                <button type="button" className={`method${addr === 'own' ? ' is-selected' : ''}`} aria-pressed={addr === 'own'} onClick={() => setAddr('own')}>
                  <span className="method__radio" />
                  <span className="row__main"><span className="row__title row__title--plain">{t.addressOwn}</span></span>
                  <span className="badge">{t.addressOwnPrice}</span>
                </button>
                {addr === 'own' && (
                  <Field hint={t.ownHint}>
                    <input className="input" autoCapitalize="none" inputMode="url" placeholder={t.ownPh} value={own} maxLength={80} onChange={(e) => setOwn(e.target.value)} aria-label={t.addressOwn} />
                  </Field>
                )}
              </div>
            </section>

            <section className="group">
              <h2 className="label-caps group__label">{t.methods}</h2>
              <div className="stack stack--2" role="radiogroup" aria-label={t.methods}>
                {([
                  ['paysera', t.paysera, settings.payseraOn ? t.payseraMeta : t.payseraSoon, !settings.payseraOn],
                  ['bank', t.bank, t.bankMeta, false],
                  ['cash', t.cash, t.cashMeta, false],
                ] as [string, string, string, boolean][]).map(([k, title, meta, off]) => (
                  <button key={k} type="button" role="radio" aria-checked={method === k} disabled={off} className={`method${method === k ? ' is-selected' : ''}`} onClick={() => { setMethod(k); setPayErr(''); }}>
                    <span className="method__radio" />
                    <span className="row__main"><span className="row__title row__title--plain">{title}</span><span className="row__meta">{meta}</span></span>
                  </button>
                ))}
              </div>
              {payErr && <p className="note note--danger" role="alert" style={{ marginTop: 8 }}>{payErr}</p>}
            </section>
            <p className="t-small t-3 t-center">{t.trust(settings.supportName)}</p>
          </main>
        </div>
        <div className="bar is-visible">
          <div className="bar__in">
            <p className="bar__summary"><b className="t-num">{eur(total)}</b><span>{t.total} · {t.once}{addr === 'own' && own.trim() ? ` · ${t.addressOwnPrice}` : ''}</span></p>
            <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={checkout}>{t.goPay}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================== payment pending */
  if (status === 'payment_pending') {
    const ref = payment?.reference || '';
    const m = payment?.method || 'bank';
    const rows: [string, string][] = [[t.iban, settings.bank.iban], [t.holder, settings.bank.holder], [t.bankName, settings.bank.name], [t.amount, eur(payment?.amountCents || settings.priceCents)], [t.reference, ref]];
    return (
      <div className="page page--subtle"><div className="app"><main className="app__pad">
        <div className="stack stack--6" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <div className="stack stack--2">
            <h1 className="t-h1">{m === 'bank' && !paidClicked ? t.bankTitle : t.pendingTitle}</h1>
            <p className="t-2">{m === 'cash' ? t.pendingCash : m === 'bank' && !paidClicked ? t.bankHint : t.pendingText}</p>
          </div>
          {m === 'bank' && (
            <dl className="card">
              {rows.map(([k, v]) => (
                <div className="kv" key={k}>
                  <dt>{k}</dt>
                  <dd className="t-num">{v}<button className="iconbtn" style={{ width: 36, height: 36 }} onClick={() => copyText(v.replace(/ €$/, ''), t.copied)} aria-label={`${sq.settings.copy} ${k}`}><Icon name="copy" size="sm" /></button></dd>
                </div>
              ))}
            </dl>
          )}
          <div className="stack stack--2">
            {m === 'bank' && !paidClicked && <button className="btn btn--primary" onClick={() => setPaidClicked(true)}>{t.iPaid}</button>}
            {m === 'cash'
              ? <a className="btn btn--whatsapp" href={wa(settings.supportWa, sq.wa.cashPage(ref))} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.writeUs}</a>
              : <a className="btn btn--secondary" href={supportLink} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.writeUs}</a>}
            <button className="btn btn--ghost" onClick={() => setStep('pay')}>{t.changeMethod}</button>
          </div>
          <div className="phone phone--frame">
            <iframe src={`/faqja/${page.id}/parapamja?v=${frameV}`} title={t.previewFrame} />
          </div>
        </div>
      </main></div></div>
    );
  }

  /* ================================================================== preview */
  return (
    <div className="pv">
      {page.notice && <p className="note note--warn" role="status" style={{ borderRadius: 0 }}>{page.notice}</p>}
      <div className="pv__frame">
        <div className="phone phone--frame">
          <iframe key={frameV} src={`/faqja/${page.id}/parapamja?v=${frameV}`} title={t.previewFrame} />
        </div>
      </div>
      <div className="bar is-visible bar--stack">
        <div className="bar__in">
          <p className="bar__note">{t.yours}</p>
          <button className="btn btn--primary" onClick={() => setStep('pay')}>{t.buy(eur(settings.priceCents))}</button>
          <div className="pv__tools">
            <button className="btn btn--secondary btn--sm" onClick={() => setSheet('change')} disabled={busy}><Icon name="sparkles" size="sm" />{t.changeSomething}</button>
            <button className={`btn btn--secondary btn--sm${busy && sheet === '' ? ' is-loading' : ''}`} onClick={nextStyle} disabled={busy}>{t.tryStyle}</button>
          </div>
        </div>
      </div>

      <Sheet open={sheet === 'change'} onClose={() => setSheet('')} title={t.changeTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy || page.revisionsLeft === 0} onClick={() => generate({ revision_note: note, text: about })}>{t.rebuild}</button>}>
        <div className="stack">
          <p className="t-2">{page.revisionsLeft > 0 ? t.changeText(page.revisionsLeft) : sq.errors.revisions_used}</p>
          <Field label={t.changeNote} htmlFor="cn">
            <textarea className="input" id="cn" rows={3} maxLength={600} placeholder={t.changeNotePh} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label={t.changeAbout} htmlFor="ca">
            <textarea className="input" id="ca" rows={5} maxLength={4000} value={about} onChange={(e) => setAbout(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
