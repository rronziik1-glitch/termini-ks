'use client';
// "S'të erdhi?" under the code boxes, with retry logic:
//  - after a code is sent, "Dërgoje përsëri" unlocks after a countdown (30 s, then 60 s, then 90 s), so people wait
//    for a slow SMS instead of asking for many codes (each one costs money and only the newest one works);
//  - after 2 resends without success it also offers WhatsApp support.
// `sentAt` changes every time a code was sent (the parent passes Date.now()), which restarts the countdown.
import { useEffect, useState } from 'react';
import { sq } from '@/lib/sq';

const WAITS = [30, 60, 90];

export default function ResendCode({ sentAt, resends, onResend, supportWa }: {
  sentAt: number; resends: number; onResend: () => void | Promise<void>; supportWa?: string;
}) {
  const t = sq.login;
  const wait = WAITS[Math.min(resends, WAITS.length - 1)];
  const [left, setLeft] = useState(wait);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((sentAt + wait * 1000 - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sentAt, wait]);

  async function click() {
    if (left > 0 || busy) return;
    setBusy(true);
    try { await onResend(); } finally { setBusy(false); }
  }

  const wa = supportWa ? `https://wa.me/${supportWa.replace(/\D/g, '')}?text=${encodeURIComponent(sq.wa.codeHelp)}` : '';
  return (
    <span aria-live="polite">
      {t.resendQ}{' '}
      {left > 0
        ? <span className="t-3 t-num">{t.resendIn(left)}</span>
        : <button type="button" className="link" onClick={click} disabled={busy}>{t.resend}</button>}
      {resends >= 2 && wa && <>{' · '}<a className="link" href={wa} target="_blank" rel="noopener noreferrer">{t.helpWa}</a></>}
    </span>
  );
}
