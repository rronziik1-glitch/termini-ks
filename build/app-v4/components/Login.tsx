'use client';
// Owner login: phone number + 6-digit code. In dev the code is shown on screen (no SMS provider yet).
import Link from 'next/link';
import { useState } from 'react';
import { ApiError, CodeInput, Field, PhoneInput, Wordmark, api, toast, toastError } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { sq } from '@/lib/sq';

const t = sq.login;

export default function Login({ next }: { next: string }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState<{ phone?: string; code?: string }>({});
  const [busy, setBusy] = useState(false);

  async function send(again = false) {
    if (!normalizePhone(phone)) { setError({ phone: sq.errors.invalid_phone }); return; }
    setBusy(true); setError({});
    try {
      const r = await api<{ dev_code?: string; channel?: string }>('/auth/code', { body: { phone } });
      setSent(true); setCode(''); setDevCode(r.dev_code || '');
      toast(again ? t.resent : t.codeSent(r.channel));
      setTimeout(() => document.getElementById('code-1')?.focus(), 50);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_phone') setError({ phone: e.message }); else toastError(e);
    }
    setBusy(false);
  }

  async function verify(value = code) {
    if (value.length < 6) { setError({ code: sq.errors.wrong_code }); return; }
    setBusy(true); setError({});
    try {
      const r = await api<{ user: { role: string }; has_business: boolean }>('/auth/verify', { body: { phone, code: value } });
      window.location.assign(next || (r.has_business ? '/app' : r.user.role === 'admin' ? '/admin' : '/fillo'));
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && (e.code === 'wrong_code' || e.code === 'code_expired')) { setError({ code: e.message }); setCode(''); } else toastError(e);
    }
  }

  return (
    <div className="page">
      <div className="app app--bar">
        <header className="topbar"><Link href="/" aria-label="Termini"><Wordmark /></Link></header>
        <main className="app__pad">
          <form className="stack stack--6" style={{ paddingTop: 24 }} noValidate onSubmit={(e) => { e.preventDefault(); if (sent) verify(); else send(); }}>
            <div className="stack stack--2">
              <h1 className="t-h1">{t.title}</h1>
              <p className="t-2">{t.text}</p>
            </div>
            <Field label={t.phone} htmlFor="phone" error={error.phone}>
              <PhoneInput id="phone" value={phone} onChange={(v) => { setPhone(v); if (sent) { setSent(false); setDevCode(''); } }} placeholder={sq.onboarding.phonePh} invalid={!!error.phone} />
            </Field>
            {sent && (
              <Field label={t.code} htmlFor="code-1" error={error.code}
                hint={<>{t.resendQ} <button type="button" className="link" onClick={() => send(true)}>{t.resend}</button></>}>
                <CodeInput value={code} onChange={setCode} onComplete={verify} />
              </Field>
            )}
            {sent && devCode && <p className="note note--dev">{t.devCode(devCode)}</p>}
            <p className="t-small t-2">{t.noAccount} <Link className="link" href="/fillo">{sq.brand.getLink}</Link></p>
            <button type="submit" hidden />
          </form>
        </main>
      </div>
      <div className="bar is-visible">
        <div className="bar__in">
          <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={() => (sent ? verify() : send())}>{sent ? t.enter : t.sendCode}</button>
        </div>
      </div>
    </div>
  );
}
