'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, Icon, Sheet, api, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';

const t = sq.confirmation;

/** "Anulo terminin" link + the "A je i sigurt?" sheet. After the cut-off the sheet only offers a call. */
export default function CancelBooking({ token, sureText, tooLateText, tel }: { token: string; sureText: string; tooLateText: string; tel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [late, setLate] = useState(tooLateText);

  async function cancel() {
    setBusy(true);
    try {
      await api(`/public/bookings/${token}/cancel`, { method: 'POST', body: {} });
      setOpen(false);
      router.refresh();
      window.scrollTo(0, 0);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_late') setLate(e.message); else toastError(e);
    }
    setBusy(false);
  }

  return (
    <>
      <button className="link link--danger t-small" style={{ minHeight: 44 }} onClick={() => setOpen(true)}>{t.cancel}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.sureTitle}
        actions={<>
          {late
            ? <a className="btn btn--primary" href={`tel:${tel}`}><Icon name="phone" size="sm" />{sq.common.call}</a>
            : <button className={`btn btn--danger${busy ? ' is-loading' : ''}`} disabled={busy} onClick={cancel}>{t.yesCancel}</button>}
          <button className="btn btn--secondary" onClick={() => setOpen(false)}>{t.noKeep}</button>
        </>}>
        <p className="t-2" style={{ textAlign: 'left' }}>{late || sureText}</p>
      </Sheet>
    </>
  );
}
