'use client';
// Onboarding (fable/termini-ui/onboarding.html). Steps 1–3 are kept in localStorage; the phone is verified last.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError, CodeInput, Field, Icon, PhoneInput, SuccessMark, Switch, TimeSelect, api, copyText, toast, toastError } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { slugify } from '@/lib/slug';
import { sq } from '@/lib/sq';
import ResendCode from '@/components/ResendCode';
import { DAYS, DAYS_NAME, DAYS_SHORT, cap } from '@/lib/time';

const t = sq.onboarding;
const STORE = 'termini.onboarding.v1';
const TYPES = ['berber', 'salon', 'dentist', 'klinike', 'bujtine', 'dasma', 'autoshkolla', 'lavazh', 'tjeter'];

type Svc = { key: number; name: string; durationMin: string; price: string; priceFrom: boolean; active: boolean };
type Day = { weekday: number; open: boolean; start: string; end: string };
type Preset = { services: { name: string; durationMin: number; priceCents: number | null; priceFrom?: boolean; active?: boolean }[]; hours: { weekday: number; start: string; end: string }[] };
let keySeq = 1;

const presetServices = (p: Preset): Svc[] => p.services.map((s) => ({
  key: keySeq++, name: s.name, durationMin: String(s.durationMin), price: s.priceCents === null ? '' : String(s.priceCents / 100).replace('.', ','), priceFrom: !!s.priceFrom, active: s.active !== false,
}));
const presetDays = (p: Preset): Day[] => [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
  const h = p.hours.find((x) => x.weekday === weekday);
  return { weekday, open: !!h, start: h?.start || '09:00', end: h?.end || '14:00' };
});

export default function Onboarding({ linkPrefix, user, prefill, listing }: {
  linkPrefix: string; user: { name: string; phone: string } | null; prefill: { name: string; city: string; category: string }; listing?: string;
}) {
  const [step, setStep] = useState(1);
  const [back, setBack] = useState(false);
  const [name, setName] = useState(prefill.name);
  const [category, setCategory] = useState(prefill.category || 'berber');
  const [city, setCity] = useState(prefill.city || sq.cities[0]);
  const [slug, setSlug] = useState(slugify(prefill.name));
  const [slugNote, setSlugNote] = useState('');
  const [services, setServices] = useState<Svc[]>([]);
  const [servicesFor, setServicesFor] = useState('');          // category the list was prefilled for
  const [touched, setTouched] = useState(false);               // the owner edited the services
  const [days, setDays] = useState<Day[]>([]);
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [resends, setResends] = useState(0);
  const [support, setSupport] = useState('');
  const [errors, setErrors] = useState<{ name?: string; services?: string; hours?: string; phone?: string; code?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ slug: string; url: string } | null>(null);
  const [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  /* restore a half-finished sign-up */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && !prefill.name) {
        setName(s.name || ''); setCategory(s.category || 'berber'); setCity(s.city || sq.cities[0]); setSlug(slugify(s.name || ''));
        if (Array.isArray(s.services) && s.services.length) { setServices(s.services.map((x: Svc) => ({ ...x, key: keySeq++ }))); setServicesFor(s.category); setTouched(!!s.touched); }
        if (Array.isArray(s.days) && s.days.length === 7) setDays(s.days);
        if (s.ownerName && !user) setOwnerName(s.ownerName);
      }
    } catch { /* start fresh */ }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready || done) return;
    try { localStorage.setItem(STORE, JSON.stringify({ name, category, city, services, days, touched, ownerName })); } catch { /* private mode */ }
  }, [ready, done, name, category, city, services, days, touched, ownerName]);

  /* defaults for the chosen category */
  useEffect(() => {
    if (!ready || (servicesFor === category && days.length === 7)) return;
    let live = true;
    api<Preset>(`/category-presets/${category}`).then((p) => {
      if (!live) return;
      if (!touched || !services.length) { setServices(presetServices(p)); setTouched(false); }
      if (days.length !== 7 || !touched) setDays(presetDays(p));
      setServicesFor(category);
    }).catch(toastError);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, category]);

  /* live link check */
  useEffect(() => {
    const s = slugify(name);
    setSlug(s); setSlugNote('');
    if (s.length < 3) return;
    const timer = setTimeout(() => {
      api<{ slug: string; available: boolean; suggestion: string }>(`/slug-check?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`)
        .then((r) => { if (!r.available) { setSlug(r.suggestion); setSlugNote(sq.errors.slug_taken(r.suggestion)); } })
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [name, city]);

  const go = (n: number) => { setBack(n < step); setStep(n); setErrors({}); window.scrollTo(0, 0); setTimeout(() => heading.current?.focus({ preventScroll: true }), 0); };
  const patchSvc = (key: number, p: Partial<Svc>) => { setTouched(true); setServices((list) => list.map((s) => (s.key === key ? { ...s, ...p } : s))); };
  const patchDay = (weekday: number, p: Partial<Day>) => setDays((list) => list.map((d) => (d.weekday === weekday ? { ...d, ...p } : d)));

  function copyMonday() {
    const before = days, mon = days[0];
    setDays(days.map((d) => (d.open ? { ...d, start: mon.start, end: mon.end } : d)));
    toast(t.copied, { action: sq.common.undo, onAction: () => setDays(before) });
  }

  async function createBusiness() {
    const r = await api<{ slug: string; url: string }>('/business', {
      body: {
        name, category, city, slug, owner_name: ownerName, listing,
        services: services.filter((s) => s.name.trim()).map((s) => ({ name: s.name, durationMin: s.durationMin, price: s.price, priceFrom: s.priceFrom, active: s.active })),
        hours: { days, pause: { on: false, start: '13:00', end: '13:30' } },
      },
    });
    try { localStorage.removeItem(STORE); } catch { /* fine */ }
    setDone(r); setStep(5); window.scrollTo(0, 0);
  }

  async function next() {
    if (step === 1) {
      if (name.trim().length < 2) { setErrors({ name: sq.errors.business_name }); document.getElementById('biz')?.focus(); return; }
      return go(2);
    }
    if (step === 2) {
      if (!services.some((s) => s.active && s.name.trim().length >= 2)) { setErrors({ services: sq.errors.no_service }); return; }
      return go(3);
    }
    if (step === 3) {
      if (days.some((d) => d.open && d.end <= d.start)) { setErrors({ hours: sq.errors.hours_order }); return; }
      return go(4);
    }
    setBusy(true); setErrors({});
    try {
      if (user) await createBusiness();
      else if (!sent) {
        if (!normalizePhone(phone)) { setErrors({ phone: sq.errors.invalid_phone }); setBusy(false); return; }
        const r = await api<{ dev_code?: string; support?: string }>('/auth/code', { body: { phone } });
        setSentAt(Date.now()); setResends(0); setSupport(r.support || '');
        setSent(true); setDevCode(r.dev_code || ''); toast(sq.login.codeSent((r as { channel?: string }).channel));
        setTimeout(() => document.getElementById('code-1')?.focus(), 50);
      } else await verify(code);
    } catch (e) { handle(e); }
    setBusy(false);
  }

  async function verify(value: string) {
    if (value.length < 6) { setErrors({ code: sq.errors.wrong_code }); return; }
    setBusy(true);
    try {
      const r = await api<{ has_business: boolean }>('/auth/verify', { body: { phone, code: value, name: ownerName } });
      if (r.has_business) { toast(sq.errors.has_business); window.location.assign('/app'); return; }
      await createBusiness();
    } catch (e) { handle(e); }
    setBusy(false);
  }

  function handle(e: unknown) {
    const c = e instanceof ApiError ? e.code : '';
    if (c === 'wrong_code' || c === 'code_expired') { setErrors({ code: (e as ApiError).message }); setCode(''); }
    else if (c === 'invalid_phone') setErrors({ phone: (e as ApiError).message });
    else if (c === 'has_business') window.location.assign('/app');
    else if (c === 'business_name') { go(1); setErrors({ name: (e as ApiError).message }); }
    else if (c === 'no_service' || c === 'service_name') { go(2); setErrors({ services: (e as ApiError).message }); }
    else if (c === 'hours_order') { go(3); setErrors({ hours: (e as ApiError).message }); }
    else toastError(e);
  }

  const label = step < 4 ? sq.common.next : user || sent ? t.openAccount : t.sendCode;
  const H = (id: string, text: string) => <h1 className="t-h1" id={id} ref={heading} tabIndex={-1} style={{ outline: 0 }}>{text}</h1>;

  if (done) {
    const shown = linkPrefix + done.slug;
    return (
      <div className="page"><div className="app"><main className="app__pad">
        <section data-step="5" className="is-active">
          <div className="stack stack--6" style={{ paddingTop: 56, paddingBottom: 40 }}>
            <SuccessMark />
            <div className="stack stack--2">
              <h1 className="t-display">{t.doneTitle}</h1>
              <p className="t-2">{t.doneText}</p>
            </div>
            <div className="linkbox"><p className="linkbox__url">{linkPrefix}<b>{done.slug}</b></p></div>
            <div className="stack stack--2">
              <button className="btn btn--primary" onClick={() => copyText(done.url)}><Icon name="copy" size="sm" />{t.copyLink}</button>
              <a className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(sq.wa.share({ business: name.trim(), link: done.url }))}`}><Icon name="whatsapp" />{t.shareWa}</a>
              <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                <a className="btn btn--secondary" href="/api/business/qr.svg?download=1" download><Icon name="qr" size="sm" />{t.qr}</a>
                <a className="btn btn--secondary" href={`/b/${done.slug}`} target="_blank" rel="noopener noreferrer"><Icon name="eye" size="sm" />{t.asCustomer}</a>
              </div>
            </div>
            <a className="btn btn--ghost" href="/app">{t.toCalendar}<Icon name="chevron-right" size="sm" /></a>
            <p className="sr" aria-live="polite">{shown}</p>
          </div>
        </section>
      </main></div></div>
    );
  }

  return (
    <div className={`page${back ? ' is-back' : ''}`}>
      <div className="app app--bar">
        <header className="topbar">
          {step > 1 ? <button className="iconbtn" onClick={() => go(step - 1)} aria-label={sq.common.back}><Icon name="chevron-left" /></button>
            : <Link className="iconbtn" href="/" aria-label={sq.common.back}><Icon name="chevron-left" /></Link>}
          <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={sq.common.step}>
            {[1, 2, 3, 4].map((n) => <span key={n} className={n <= step ? 'is-done' : ''} />)}
          </div>
          <span className="t-caption t-3 t-num" style={{ minWidth: 32, textAlign: 'right' }}>{step} / 4</span>
        </header>

        <main className="app__pad">
          {step === 1 && (
            <section data-step="1" className="is-active" aria-labelledby="o1">
              <div className="stack stack--6" style={{ paddingTop: 16 }}>
                <div className="stack stack--2">{H("o1", t.s1)}<p className="t-2">{t.s1Text}</p></div>
                <Field label={t.bizName} htmlFor="biz" error={errors.name}>
                  <input className="input" id="biz" autoComplete="organization" placeholder={t.bizPh} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
                  <p className="slugline" aria-live="polite">{linkPrefix}<b>{slug || 'biznesi-yt'}</b></p>
                  {slugNote && <p className="field__hint">{slugNote}</p>}
                </Field>
                <div className="stack stack--3">
                  <p className="field__label" id="type-l">{t.type}</p>
                  <div className="chips chips--wrap" role="group" aria-labelledby="type-l">
                    {TYPES.map((c) => <button key={c} type="button" className={`chip${category === c ? ' is-selected' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{sq.categories[c]}</button>)}
                  </div>
                </div>
                <Field label={t.city} htmlFor="city">
                  <select className="input" id="city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)}>
                    {sq.cities.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <p className="t-small t-2">{sq.login.haveAccount} <Link className="link" href="/hyr">{sq.home.login}</Link></p>
              </div>
            </section>
          )}

          {step === 2 && (
            <section data-step="2" className="is-active" aria-labelledby="o2">
              <div className="stack stack--6" style={{ paddingTop: 16 }}>
                <div className="stack stack--2">{H("o2", t.s2)}<p className="t-2">{category === 'tjeter' ? t.s2TextEmpty : t.s2Text(sq.categoriesFor[category] || sq.categoriesFor.tjeter)}</p></div>
                <div className="list--card">
                  {services.map((s) => (
                    <div className={`edit${s.active ? '' : ' is-off'}`} key={s.key}>
                      <div className="edit__top">
                        <input className="edit__name" value={s.name} placeholder={t.svcName} aria-label={t.svcName} maxLength={60} onChange={(e) => patchSvc(s.key, { name: e.target.value })} />
                        <Switch checked={s.active} onChange={(v) => patchSvc(s.key, { active: v })} label={t.offer(s.name)} />
                      </div>
                      <div className="edit__nums">
                        <label className="inputgroup inputgroup--sm"><span className="sr">{t.duration}</span><input className="input" inputMode="numeric" value={s.durationMin} onChange={(e) => patchSvc(s.key, { durationMin: e.target.value.replace(/\D/g, '').slice(0, 3) })} /><span className="inputgroup__ad inputgroup__ad--end">{sq.common.min}</span></label>
                        <label className="inputgroup inputgroup--sm"><span className="sr">{t.price}</span><input className="input" inputMode="decimal" value={s.price} onChange={(e) => patchSvc(s.key, { price: e.target.value.replace(/[^\d.,]/g, '').slice(0, 7) })} /><span className="inputgroup__ad inputgroup__ad--end">€</span></label>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.services && <p className="note note--danger" role="alert">{errors.services}</p>}
                <button className="btn btn--secondary" onClick={() => { setTouched(true); setServices((l) => [...l, { key: keySeq++, name: '', durationMin: '30', price: '', priceFrom: false, active: true }]); }}><Icon name="plus" size="sm" />{t.addService}</button>
                <p className="t-small t-3 t-center">{t.changeLater}</p>
              </div>
            </section>
          )}

          {step === 3 && (
            <section data-step="3" className="is-active" aria-labelledby="o3">
              <div className="stack stack--6" style={{ paddingTop: 16 }}>
                <div className="stack stack--2">{H("o3", t.s3)}<p className="t-2">{t.s3Text}</p></div>
                <HoursList days={days} onChange={patchDay} />
                {errors.hours && <p className="note note--danger" role="alert">{errors.hours}</p>}
                <button className="btn btn--secondary" onClick={copyMonday}><Icon name="copy" size="sm" />{t.copyMonday}</button>
                <p className="t-small t-3 t-center">{t.s3Hint}</p>
              </div>
            </section>
          )}

          {step === 4 && (
            <section data-step="4" className="is-active" aria-labelledby="o4">
              <form className="stack stack--6" style={{ paddingTop: 16 }} noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
                <div className="stack stack--2">{H("o4", t.s4)}<p className="t-2">{t.s4Text}</p></div>
                <Field label={t.yourName} htmlFor="oname">
                  <input className="input" id="oname" autoComplete="given-name" placeholder={t.yourNamePh} value={ownerName} maxLength={60} onChange={(e) => setOwnerName(e.target.value)} />
                </Field>
                {user ? (
                  <Field label={t.phone}><p className="input t-num" style={{ display: 'flex', alignItems: 'center' }}>{user.phone}</p></Field>
                ) : (
                  <Field label={t.phone} htmlFor="ophone" error={errors.phone}>
                    <PhoneInput id="ophone" value={phone} onChange={(v) => { setPhone(v); if (sent) { setSent(false); setCode(''); setDevCode(''); } }} placeholder={t.phonePh} invalid={!!errors.phone} />
                  </Field>
                )}
                {sent && !user && (
                  <Field label={sq.login.code} htmlFor="code-1" error={errors.code}
                    hint={<ResendCode sentAt={sentAt} resends={resends} supportWa={support}
                      onResend={() => api<{ dev_code?: string }>('/auth/code', { body: { phone } }).then((r) => { setDevCode(r.dev_code || ''); setSentAt(Date.now()); setResends((n) => n + 1); toast(sq.login.resent); }).catch(toastError)} />}>
                    <CodeInput value={code} onChange={setCode} onComplete={verify} />
                  </Field>
                )}
                {sent && devCode && <p className="note note--dev">{sq.login.devCode(devCode)}</p>}
                <button type="submit" hidden />
              </form>
            </section>
          )}
        </main>
      </div>

      <div className="bar is-visible">
        <div className="bar__in">
          <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={next}>{label}</button>
        </div>
      </div>
    </div>
  );
}

/** Weekly hours rows: shared by onboarding and Cilësimet → Orari. */
export function HoursList({ days, onChange }: { days: Day[]; onChange: (weekday: number, p: Partial<Day>) => void }) {
  return (
    <div className="list--card">
      {days.map((d) => {
        const full = cap(DAYS[d.weekday - 1]);
        return (
          <div className={`hours${d.open ? '' : ' is-off'}`} key={d.weekday}>
            <span className="hours__day"><span>{DAYS_NAME[d.weekday - 1]}</span><abbr title={full}>{DAYS_SHORT[d.weekday - 1]}</abbr></span>
            <span className="hours__times">
              <TimeSelect value={d.start} onChange={(v) => onChange(d.weekday, { start: v })} label={`${full}, ${t.from}`} />
              <span>–</span>
              <TimeSelect value={d.end} onChange={(v) => onChange(d.weekday, { end: v })} label={`${full}, ${t.to}`} />
            </span>
            <span className="hours__closed">{sq.common.closed}</span>
            <Switch checked={d.open} onChange={(v) => onChange(d.weekday, { open: v })} label={`${full}, ${t.openLabel}`} />
          </div>
        );
      })}
    </div>
  );
}
