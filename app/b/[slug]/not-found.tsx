import Link from 'next/link';
import { Wordmark } from '@/components/ui';
import { sq } from '@/lib/sq';

export default function BusinessNotFound() {
  return (
    <div className="page">
      <div className="app">
        <main className="app__pad stack" style={{ paddingTop: 96 }}>
          <h1 className="t-h1">{sq.booking.notFoundTitle}</h1>
          <p className="t-2">{sq.booking.notFoundText}</p>
          <Link className="btn btn--primary" href="/gjej" style={{ marginTop: 16 }}>{sq.booking.searchBiz}</Link>
        </main>
        <p className="footnote mt-auto"><Link href="/"><Wordmark small /></Link></p>
      </div>
    </div>
  );
}
