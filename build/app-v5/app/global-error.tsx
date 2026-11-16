'use client';
// Last-resort Albanian error page: shown when the root layout itself fails, so it carries its own
// <html>, <body> and styles (no shared CSS or components can be trusted here).
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[global-error]', error); }, [error]);
  return (
    <html lang="sq">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box', textAlign: 'center', font: '16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', background: '#f6f6f3', color: '#0c0c0d' }}>
        <main style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Diçka shkoi keq</h1>
          <p style={{ margin: '0 0 20px', color: '#55555a' }}>Nuk është faji yt. Provo përsëri; nëse vazhdon, na shkruaj në WhatsApp.</p>
          <button type="button" onClick={() => reset()} style={{ padding: '14px 22px', border: 0, borderRadius: 999, background: '#0c0c0d', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Provo përsëri</button>
          {error.digest && <p style={{ marginTop: 16, fontSize: '0.8125rem', color: '#8a8a90' }}>Kodi i gabimit: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
