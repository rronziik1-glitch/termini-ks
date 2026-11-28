// v7 review page (link in the "how was it?" message): 1-5 stars, then everyone gets the business's Google review link
// (asking only happy clients for public reviews breaks Google's rules) and can also write privately to the owner.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';
import { Wordmark } from '@/components/ui';
import { db } from '@/lib/db';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const b = await db.booking.findUnique({ where: { token: (await params).token }, include: { business: true } });
  if (!b || b.business.suspendedAt) notFound();
  const done = await db.feedback.findUnique({ where: { bookingId: b.id } });
  return (
    <div className="page page--subtle">
      <div className="app">
        <header className="topbar"><Link href="/" aria-label="Termini" className="grow"><Wordmark /></Link></header>
        <main className="app__pad stack stack--6" style={{ paddingTop: 32, paddingBottom: 40 }}>
          <ReviewForm token={(await params).token} business={b.business.name} visitOver={b.endsAt <= new Date()}
            done={done ? { rating: done.rating, hasComment: !!done.comment } : null} google={b.business.googleReviewUrl} />
          <p className="t-small t-3 t-center">{sq.brand.bookedVia} <Link className="link" href="/">Termini</Link></p>
        </main>
      </div>
    </div>
  );
}
