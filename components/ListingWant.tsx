'use client';
// v7 "Dua të rezervoj këtu" on an unclaimed listing: name + number. The count is shown to the business (via the admin).
import { useState } from 'react';
import { ApiError, Field, PhoneInput, api, toastError } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { sq } from '@/lib/sq';

const t = sq.g;

export default function ListingWant({ slug }: { slug: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');
  const [err, setErr] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    const e: typeof err = {};
    if (name.trim().length < 2) e.name = sq.errors.name_required;
    if (!normalizePhone(phone)) e.phone = sq.errors.invalid_phone;
    setErr(e);
    if (e.name || e.phone) return;
    setBusy(true);
    try { await api(`/public/listings/${slug}/request`, { body: { name, phone, note, website } }); setDone(true); }
    catch (x) { if (x instanceof ApiError && (x.code === 'invalid_phone' || x.code === 'name_required')) setErr({ [x.code === 'invalid_phone' ? 'phone' : 'name']: x.message }); else toastError(x); }
    setBusy(false);
  }

  if (done) return <section className="card stack stack--2" role="status"><h2 className="t-h3">{t.wantTitle}</h2><p className="t-2">{t.wantDone}</p></section>;
  return (
    <section className="card stack stack--4" aria-labelledby="want-h">
      <div className="stack stack--1">
        <h2 className="t-h2" id="want-h">{t.wantTitle}</h2>
        <p className="t-small t-2">{t.wantText}</p>
      </div>
      <form className="stack stack--3" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Field label={t.wantName} htmlFor="w-name" error={err.name}>
          <input className="input" id="w-name" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!err.name} />
        </Field>
        <Field label={t.wantPhone} htmlFor="w-phone" error={err.phone}>
          <PhoneInput id="w-phone" value={phone} onChange={setPhone} placeholder={sq.booking.phonePh} invalid={!!err.phone} />
        </Field>
        <Field label={t.wantNote} htmlFor="w-note">
          <input className="input" id="w-note" value={note} maxLength={200} placeholder={t.wantNotePh} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <input className="sr" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} type="submit">{t.wantSend}</button>
      </form>
    </section>
  );
}
