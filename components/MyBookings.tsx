'use client';
// v6 "Rezervimet e mia": the customer types their number, gets a code, and sees every booking made with that number
// (upcoming first, then history). Each booking opens its own page (/b/<slug>/t/<token>), where it can be cancelled.
import Link from 'next/link';
import { useState } from 'react';
import { ApiError, CodeInput, Field, Icon, PhoneInput, Wordmark, api, toast, toastError } from '@/components/ui';
import { displayPhone, normalizePhone } from '@/lib/phone';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, diffDays, fmtDayMonth, fmtPrice, toLocal, weekdayOf } from '@/lib/time';

const t = sq.my;
type Item = { token: string; date: string; time: string; service: string; priceCents: number | null; status: string; business: string; slug: string; place: string; businessPhone: string };
type Data = { phone: string; upcoming: Item[]; past: Item[] };

const statusBadge = (s: string) => (s === 'confirmed' ? 'badge--ok' : s === 'pending' ? 'badge--new' : s === 'no_show' || s.startsWith('cancelled') || s === 'expired' ? 'badge--danger' : '');

export default function MyBookings({ initial }: { initial: Data | null }) {
  const [data, setData] = useState<Data | null>(initial);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState<{ phone?: string; code?: string }>({});
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!normalizePhone(phone)) { setError({ phone: sq.errors.invalid_phone }); return; }
    setBusy(true); setError({});
    try {
      const r = await api<{ dev_code?: string }>('/my/code', { body: { phone } });
      setSent(true); setCode(''); setDevCode(r.dev_code || '');
      toast(t.codeSent(displayPhone(normalizePhone(phone))));
      setTimeout(() => document.getElementById('code-1')?.focus(), 50);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'invalid_phone' || e.code === 'phone_country')) setError({ phone: e.message }); else toastError(e);
    }
    setBusy(false);
  }
  async function verify(value = code) {
    if (value.length < 6) { setError({ code: sq.errors.wrong_code }); return; }
    setBusy(true); setError({});
    try { setData(await api<Data>('/my/verify', { body: { phone, code: value } })); }
    catch (e) {
      if (e instanceof ApiError && (e.code === 'wrong_code' || e.code === 'code_expired')) { setError({ code: e.message }); setCode(''); } else toastError(e);
    }
    setBusy(false);
  }
  async function logout() {
    await api('/my/logout', { body: {} }).catch(() => undefined);
    setData(null); setSent(false); setPhone(''); setCode(''); setDevCode('');
  }

  const header = (
    <header className="topbar">
      <Link href="/" aria-label="Termini" className="grow"><Wordmark /></Link>
      {data && <button className="btn btn--ghost btn--sm btn--auto" onClick={logout}>{t.logout}</button>}
    </header>
  );

  if (!data) {
    return (
      <div className="page">
        <div className="app app--bar">
          {header}
          <main className="app__pad">
            <form className="stack stack--6" style={{ paddingTop: 24 }} noValidate onSubmit={(e) => { e.preventDefault(); if (sent) verify(); else send(); }}>
              <div className="stack stack--2">
                <h1 className="t-h1">{t.title}</h1>
                <p className="t-2">{t.intro}</p>
              </div>
              <Field label={t.phone} htmlFor="phone" error={error.phone}>
                <PhoneInput id="phone" value={phone} onChange={(v) => { setPhone(v); if (sent) { setSent(false); setDevCode(''); } }} placeholder={sq.onboarding.phonePh} invalid={!!error.phone} />
              </Field>
              {sent && (
                <Field label={t.codeTitle} htmlFor="code-1" error={error.code}
                  hint={<>{sq.login.resendQ} <button type="button" className="link" onClick={() => send()}>{sq.login.resend}</button></>}>
                  <CodeInput value={code} onChange={setCode} onComplete={verify} />
                </Field>
              )}
              {sent && devCode && <p className="note note--dev">{t.devCode(devCode)}</p>}
              <button type="submit" hidden />
            </form>
          </main>
        </div>
        <div className="bar is-visible">
          <div className="bar__in">
            <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={() => (sent ? verify() : send())}>{sent ? t.verify : t.sendCode}</button>
          </div>
        </div>
      </div>
    );
  }

  const today = toLocal(new Date()).date;
  const when = (date: string) => { const n = diffDays(today, date); return n === 0 ? sq.common.today : n === 1 ? sq.common.tomorrow : `${DAYS_SHORT[weekdayOf(date) - 1]}, ${fmtDayMonth(date)}`; };
  const Row = ({ b, past }: { b: Item; past?: boolean }) => (
    <li>
      <Link className="row" href={`/b/${b.slug}/t/${b.token}`}>
        <span className="sa-brow__time my-time t-num"><span className="t-caption t-3">{past ? fmtDayMonth(b.date) : when(b.date)}</span>{b.time}</span>
        <span className="row__main">
          <span className="row__title">{b.business}</span>
          <span className="row__meta">{b.service}{b.priceCents !== null ? ` · ${fmtPrice(b.priceCents)}` : ''}</span>
          {!past && b.place && <span className="row__meta t-3">{b.place}</span>}
        </span>
        {(past || b.status === 'pending') && <span className={`badge ${statusBadge(b.status)}`}>{sq.sa.bstatus[b.status] || b.status}</span>}
        <span className="row__end"><Icon name="chevron-right" size="sm" /></span>
      </Link>
    </li>
  );

  return (
    <div className="page page--subtle">
      <div className="app">
        {header}
        <main className="app__pad stack stack--6" style={{ paddingTop: 16, paddingBottom: 40 }}>
          <div className="stack stack--2">
            <h1 className="t-h1">{t.title}</h1>
            <p className="t-small t-3 t-num">{t.loggedAs(data.phone)}</p>
          </div>
          <section className="stack stack--3">
            <p className="label-caps">{t.upcoming}</p>
            {data.upcoming.length === 0 ? (
              <div className="card empty">
                <p className="empty__title">{t.none}</p>
                <Link className="btn btn--primary btn--auto" href="/gjej">{t.find}</Link>
              </div>
            ) : <ul className="list--card">{data.upcoming.map((b) => <Row key={b.token} b={b} />)}</ul>}
          </section>
          <section className="stack stack--3">
            <p className="label-caps">{t.past}</p>
            {data.past.length === 0 ? <p className="card t-small t-3">{t.nonePast}</p> : <ul className="list--card">{data.past.map((b) => <Row key={b.token} b={b} past />)}</ul>}
          </section>
        </main>
      </div>
    </div>
  );
}
