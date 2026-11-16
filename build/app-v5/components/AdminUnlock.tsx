'use client';
// Second step of the admin login: the admin password (after the SMS code).
import { useState } from 'react';
import { Field, api, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';

const t = sq.admin;

export default function AdminUnlock() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true); setError('');
    try {
      await api('/admin/unlock', { body: { password } });
      window.location.reload();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      if (msg) setError(msg); else toastError(err);
      setPassword('');
    }
    setBusy(false);
  }

  return (
    <div className="page page--subtle"><div className="app"><main className="app__pad">
      <form className="card" style={{ marginTop: 48, padding: 20 }} onSubmit={submit}>
        <h1 className="empty__title" style={{ marginTop: 0 }}>{t.unlockTitle}</h1>
        <p className="field__hint" style={{ marginBottom: 16 }}>{t.unlockText}</p>
        <Field label={t.password} htmlFor="admin-pw" error={error}>
          <input className="input" id="admin-pw" type="password" autoComplete="current-password" autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error || undefined} />
        </Field>
        <button className="btn btn--primary" type="submit" disabled={busy || !password} style={{ width: '100%', marginTop: 8 }}>{t.unlock}</button>
      </form>
    </main></div></div>
  );
}
