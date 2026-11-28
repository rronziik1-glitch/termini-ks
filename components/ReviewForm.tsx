'use client';
// v7 "Si ishte?": one tap on 1-5. Then: the Google review button (for everyone) and an optional private note to the owner.
import { useState } from 'react';
import { Field, Icon, api, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';

const t = sq.g;

export default function ReviewForm({ token, business, visitOver, done, google }: {
  token: string; business: string; visitOver: boolean; done: { rating: number; hasComment: boolean } | null; google: string;
}) {
  const [rating, setRating] = useState(done?.rating || 0);
  const [rated, setRated] = useState(!!done);
  const [comment, setComment] = useState('');
  const [sentNote, setSentNote] = useState(!!done?.hasComment);
  const [busy, setBusy] = useState(false);

  async function rate(n: number) {
    if (rated || busy) return;
    setRating(n); setBusy(true);
    try { await api(`/public/review/${token}`, { body: { rating: n } }); setRated(true); } catch (e) { setRating(0); toastError(e); }
    setBusy(false);
  }
  async function sendNote() {
    if (!comment.trim()) return;
    setBusy(true);
    try { await api(`/public/review/${token}`, { body: { rating, comment } }); setSentNote(true); toast(t.reviewThanks); } catch (e) { toastError(e); }
    setBusy(false);
  }

  if (!visitOver) return <section className="card empty"><p className="empty__title">{t.reviewTitle(business)}</p></section>;
  return (
    <section className="stack stack--6">
      <div className="stack stack--2 t-center">
        <h1 className="t-h1">{t.reviewTitle(business)}</h1>
        <p className="t-2">{rated ? t.reviewDone : t.reviewText}</p>
      </div>
      <div className="stars" role="group" aria-label={t.reviewTitle(business)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={t.stars(n)} aria-pressed={rating >= n} disabled={rated || busy} onClick={() => rate(n)}>★</button>
        ))}
      </div>
      {rated && (
        <div className="stack stack--4">
          {google && (
            <a className="btn btn--primary" href={google} target="_blank" rel="noopener noreferrer"><Icon name="external" size="sm" />{t.reviewGoogle}</a>
          )}
          {google && <p className="t-small t-2 t-center">{t.reviewGoogleText}</p>}
          {!sentNote ? (
            <div className="card stack stack--3">
              <Field label={t.reviewPrivate} htmlFor="note">
                <textarea id="note" className="input" rows={3} maxLength={600} value={comment} placeholder={t.reviewPrivatePh} onChange={(e) => setComment(e.target.value)} />
              </Field>
              <button className={`btn btn--secondary${busy ? ' is-loading' : ''}`} disabled={busy || !comment.trim()} onClick={sendNote}>{t.reviewSend}</button>
            </div>
          ) : <p className="note" role="status">{t.reviewThanks}</p>}
        </div>
      )}
    </section>
  );
}
