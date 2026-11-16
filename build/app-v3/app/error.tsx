'use client';
// Albanian error page for anything that breaks while a page is being shown (Next.js error boundary).
// The technical details stay in the server log; the visitor only sees a short code to quote to support.
import Link from 'next/link';
import { useEffect } from 'react';
import { sq } from '@/lib/sq';

const t = sq.errorPage;

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[page-error]', error); }, [error]);
  return (
    <div className="page">
      <div className="app">
        <main className="app__pad stack" style={{ paddingTop: 96 }}>
          <h1 className="t-h1">{t.title}</h1>
          <p className="t-2">{t.text}</p>
          <button type="button" className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => reset()}>{t.retry}</button>
          <Link className="btn" href="/">{t.home}</Link>
          {error.digest && <p className="t-small t-3" style={{ marginTop: 16 }}>{t.code(error.digest)}</p>}
        </main>
      </div>
    </div>
  );
}
