'use client';
// Customer booking: one page, three steps, no account (fable/termini-ui/booking.html).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, Field, Icon, PhoneInput, Wordmark, api, toast, toastError } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, dayName, dayNum, diffDays, fmtDateLong, fmtDayMonth, hmToMin, weekdayOf } from '@/lib/time';

type Biz = {
  slug: string; name: string; meta: string; address: string; mapsUrl: string; tel: string; phoneDisplay: string; photoUrl: string;
  open: boolean; openText: string; paused: boolean; pausedText: string; waFull: string;
};
type Service = { id: string; name: string; meta: string; price: string };
type Day = { date: string; closed: boolean; free_count: number };
const t = sq.booking;
const REMEMBER = 'termini.customer';

export default function BookingFlow({ biz, services, staff, today, source, initialDate }: {
  biz: Biz; services: Service[]; staff: { id: string; name: string }[]; today: string; source: string; initialDate: string | null;
}) {
  const router = useRouter();
  const single = services.length === 1;
  const [step, setStep] = useState(single ? 2 : 1);
  const [back, setBack] = useState(false);
  const [service, setService] = useState<Service | null>(single ? services[0] : null);
  const [staffId, setStaffId] = useState('');
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstStep = single ? 2 : 1;
  const base = `/public/businesses/${biz.slug}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER) || '{}');
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch { /* nothing remembered */ }
  }, []);

  const go = (n: number) => {
    setBack(n < step);
    setStep(n);
    window.scrollTo(0, 0);
    setTimeout(() => heading.current?.focus({ preventScroll: true }), 0);
  };

  const loadDays = useCallback(async (svc: Service, staff: string, keep?: string | null) => {
    setDays(null); setSlots(null);
    try {
      const r = await api<{ days: Day[] }>(`${base}/days?service_id=${svc.id}&staff_id=${staff}&days=14`);
      setDays(r.days);
      const wanted = keep && r.days.find((d) => d.date === keep && d.free_count > 0);
      const first = wanted || r.days.find((d) => d.free_count > 0);
      setDate(first ? first.date : r.days[0]?.date || null);
    } catch (e) { toastError(e); setDays([]); }
  }, [base]);

  useEffect(() => { if (service && !biz.paused) loadDays(service, staffId, initialDate); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [service, staffId]);

  useEffect(() => {
    if (!service || !date) return;
    let live = true;
    setSlots(null);
    api<{ slots: string[] }>(`${base}/slots?service_id=${service.id}&staff_id=${staffId}&date=${date}`)
      .then((r) => { if (live) { setSlots(r.slots); setTime((cur) => (r.slots.includes(cur) ? cur : '')); } })
      .catch((e) => { if (live) { toastError(e); setSlots([]); } });
    return () => { live = false; };
  }, [service, staffId, date, base]);

  const groups = useMemo(() => {
    const g: [string, string[]][] = [[t.morning, []], [t.afternoon, []], [t.evening, []]];
    for (const s of slots || []) g[hmToMin(s) < 720 ? 0 : hmToMin(s) < 1020 ? 1 : 2][1].push(s);
    return g.filter((x) => x[1].length);
  }, [slots]);

  const nextFree = days?.find((d) => d.free_count > 0 && d.date !== date);
  const allFull = !!days && days.length > 0 && !days.some((d) => d.free_count > 0);
  const title = service ? [service.name, service.price].filter(Boolean).join(' · ') : '';
  const when = date ? fmtDateLong(date) : '';
  const dayLabel = (d: Day) => (d.closed ? t.closedDay : d.free_count === 0 ? t.full : d.date === today ? sq.common.today : diffDays(today, d.date) === 1 ? sq.common.tomorrow : DAYS_SHORT[weekdayOf(d.date) - 1]);

  async function confirm() {
    const errs: typeof errors = {};
    if (name.trim().length < 2) errs.name = sq.errors.name_required;
    if (!normalizePhone(phone)) errs.phone = sq.errors.invalid_phone;
    setErrors(errs);
    if (errs.name || errs.phone) { document.getElementById(errs.name ? 'name' : 'phone')?.focus(); return; }
    if (!service || !date || !time) return go(2);
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`${base}/bookings`, { body: { service_id: service.id, staff_id: staffId, date, time, name, phone, note, source, website } });
      try { localStorage.setItem(REMEMBER, JSON.stringify({ name: name.trim(), phone: phone.trim() })); } catch { /* private mode */ }
      router.push(`/b/${biz.slug}/t/${r.token}`);
    } catch (e) {
      setBusy(false);
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'slot_taken') { toast(sq.errors.slot_taken, { error: true }); setTime(''); go(2); loadDays(service, staffId, date); }
      else if (code === 'invalid_phone') setErrors({ phone: sq.errors.invalid_phone });
      else if (code === 'name_required') setErrors({ name: sq.errors.name_required });
      else if (code === 'too_many_active' || code === 'too_many_new' || code === 'blocked' || code === 'paused') setErrors({ form: (e as ApiError).message });
      else toastError(e);
    }
  }

  const initial = biz.name.trim().charAt(0).toUpperCase();
  const header = (
    <>
      <header className="biz">
        <span className="avatar avatar--lg avatar--ink" aria-hidden="true">{biz.photoUrl ? <img src={biz.photoUrl} alt="" /> : initial}</span>
        <div className="grow">
          <h1 className="biz__name">{biz.name}</h1>
          <p className="biz__meta">
            <span>{biz.meta}</span>
            <span className="biz__open" style={biz.open ? undefined : { color: 'var(--text-2)' }}>{biz.open && <span className="dot dot--ok" />}{biz.openText}</span>
          </p>
        </div>
        <a className="iconbtn iconbtn--fill" href={`tel:${biz.tel}`} aria-label={t.callBiz(biz.name)}><Icon name="phone" /></a>
      </header>
      {biz.address && (
        <a className="biz__addr" href={biz.mapsUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="pin" size="sm" /><span className="link">{biz.address}</span>
        </a>
      )}
    </>
  );
  const foot = <p className="footnote mt-auto">{sq.brand.bookingVia} <Link href="/"><Wordmark small /></Link></p>;

  if (biz.paused || services.length === 0) {
    return (
      <div className="page"><div className="app">
        {header}
        <main className="app__pad" style={{ paddingTop: 24 }}>
          <section className="card empty">
            <p className="empty__title">{biz.paused ? biz.pausedText : t.noServices}</p>
            {biz.paused && <a className="btn btn--primary" href={`tel:${biz.tel}`}><Icon name="phone" size="sm" />{sq.common.call} {biz.phoneDisplay}</a>}
          </section>
        </main>
        {foot}
      </div></div>
    );
  }

  const shownStep = single ? step - 1 : step, totalSteps = single ? 2 : 3;
  return (
    <div className={`page${back ? ' is-back' : ''}`}>
      <div className="app app--bar">
        {header}
        <div className="app__pad split" style={{ marginTop: 12, minHeight: 44 }}>
          {step > firstStep && <button className="iconbtn" style={{ marginLeft: -10 }} onClick={() => go(step - 1)} aria-label={sq.common.back}><Icon name="chevron-left" /></button>}
          <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={shownStep} aria-label={sq.common.step}>
            {Array.from({ length: totalSteps }, (_, i) => <span key={i} className={i < shownStep ? 'is-done' : ''} />)}
          </div>
          <span className="t-caption t-3 t-num">{shownStep} / {totalSteps}</span>
        </div>

        <main>
          {step === 1 && (
            <section data-step="1" className="is-active" aria-labelledby="s1">
              <div className="app__pad section"><h2 className="t-h1" id="s1" ref={heading} tabIndex={-1} style={{ outline: 0 }}>{t.s1}</h2></div>
              <ul className="list" style={{ marginTop: 20 }}>
                {services.map((s) => (
                  <li key={s.id}>
                    <button className={`row${service?.id === s.id ? ' is-selected' : ''}`} aria-pressed={service?.id === s.id}
                      onClick={() => { if (service?.id !== s.id) { setService(s); setTime(''); } setTimeout(() => go(2), 200); }}>
                      <span className="row__main"><span className="row__title">{s.name}</span><span className="row__meta">{s.meta}</span></span>
                      <span className="row__price">{s.price || <span className="t-small t-3" style={{ fontWeight: 400 }}>{sq.common.priceOnSite}</span>}</span>
                      <span className="row__end"><Icon name="chevron-right" className="row__chev" /><span className="row__check"><Icon name="check" /></span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step === 2 && (
            <section data-step="2" className="is-active" aria-labelledby="s2">
              <div className="app__pad section stack stack--6">
                <h2 className="t-h1" id="s2" ref={heading} tabIndex={-1} style={{ outline: 0 }}>{t.s2}</h2>

                {staff.length > 0 && (
                  <div className="stack stack--3">
                    <p className="label-caps">{t.who}</p>
                    <div className="chips">
                      <button className={`chip${!staffId ? ' is-selected' : ''}`} aria-pressed={!staffId} onClick={() => setStaffId('')}>{t.anyStaff}</button>
                      {staff.map((s) => <button key={s.id} className={`chip${staffId === s.id ? ' is-selected' : ''}`} aria-pressed={staffId === s.id} onClick={() => setStaffId(s.id)}>{s.name}</button>)}
                    </div>
                  </div>
                )}

                {allFull ? (
                  <div className="empty card card--flat">
                    <p className="empty__title">{t.emptyAll}</p>
                    <a className="btn btn--whatsapp" href={biz.waFull} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.writeWa}</a>
                  </div>
                ) : (
                  <>
                    <div className="stack stack--3">
                      <p className="label-caps">{t.day}</p>
                      <div className="days">
                        {days === null
                          ? Array.from({ length: 7 }, (_, i) => <span key={i} className="day skeleton" />)
                          : days.map((d) => {
                              const off = d.closed || d.free_count === 0;
                              return (
                                <button key={d.date} className={`day${date === d.date ? ' is-selected' : ''}${off ? ' is-full' : ''}`} disabled={off} aria-pressed={date === d.date}
                                  aria-label={`${dayName(d.date)} ${fmtDayMonth(d.date)}${off ? ', ' + dayLabel(d) : ''}`} onClick={() => { setDate(d.date); setTime(''); }}>
                                  <span className="day__dow">{dayLabel(d)}</span><span className="day__num">{dayNum(d.date)}</span>
                                </button>
                              );
                            })}
                      </div>
                    </div>

                    {slots === null ? (
                      <div className="slots" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} className="slot skeleton" />)}</div>
                    ) : slots.length === 0 ? (
                      <div className="empty card card--flat">
                        <p className="empty__title">{t.emptyDay}</p>
                        {nextFree && <button className="btn btn--secondary btn--sm" onClick={() => setDate(nextFree.date)}>{t.seeDay(fmtDateLong(nextFree.date))}</button>}
                      </div>
                    ) : (
                      <div aria-label={t.freeTimes}>
                        {groups.map(([label, list]) => (
                          <div className="slotgroup" key={label}>
                            <p className="label-caps slotgroup__label">{label}</p>
                            <div className="slots">
                              {list.map((s) => <button key={s} className={`slot${time === s ? ' is-selected' : ''}`} aria-pressed={time === s} onClick={() => setTime(s)}>{s}</button>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section data-step="3" className="is-active" aria-labelledby="s3">
              <form className="app__pad section stack stack--6" noValidate onSubmit={(e) => { e.preventDefault(); confirm(); }}>
                <h2 className="t-h1" id="s3" ref={heading} tabIndex={-1} style={{ outline: 0 }}>{t.s3}</h2>
                <div className="card card--accent split">
                  <div className="grow">
                    <p className="t-h3">{title}</p>
                    <p className="t-small t-2">{when} · {t.at} {time}</p>
                  </div>
                  <button type="button" className="btn btn--ghost btn--sm btn--auto" onClick={() => go(2)}>{t.change}</button>
                </div>
                <div className="stack">
                  <Field label={t.name} htmlFor="name" error={errors.name}>
                    <input className="input" id="name" name="name" autoComplete="name" placeholder={t.namePh} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
                  </Field>
                  <Field label={t.phone} htmlFor="phone" hint={t.phoneHint} error={errors.phone}>
                    <PhoneInput id="phone" value={phone} onChange={setPhone} placeholder={t.phonePh} invalid={!!errors.phone} />
                  </Field>
                  <Field label={t.note(biz.name)} small={sq.common.optional} htmlFor="note">
                    <textarea className="input" id="note" name="note" rows={2} maxLength={300} placeholder={t.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <input className="sr" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  {errors.form && <p className="note note--danger" role="alert">{errors.form}</p>}
                </div>
                <button type="submit" hidden />
              </form>
            </section>
          )}
        </main>
        {foot}
      </div>

      <div className={`bar${step > 1 && !allFull ? ' is-visible' : ''}`}>
        {step === 3 ? (
          <div className="bar--stack">
            <div className="bar__in">
              <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} onClick={confirm} disabled={busy}>{t.confirm}</button>
              <p className="bar__note">{t.payOnSite} {service?.price}</p>
            </div>
          </div>
        ) : (
          <div className="bar__in">
            <p className="bar__summary"><b>{title}</b><span>{time ? `${when} · ${time}` : t.pickTime}</span></p>
            <button className="btn btn--primary" disabled={!time} onClick={() => go(3)}>{sq.common.next}</button>
          </div>
        )}
      </div>
    </div>
  );
}
