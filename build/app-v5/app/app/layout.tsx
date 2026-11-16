// Owner app shell: needs a session and a business. Tab bar: Kalendari · Klientët · Shërbimet · Cilësimet.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Tabs } from '@/components/ui';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const { user, business } = await getSession();
  if (!user) redirect('/hyr?next=/app');
  if (!business) redirect(user.role === 'admin' ? '/admin' : '/fillo');
  return (
    <div className="page page--subtle">
      {children}
      <Tabs />
    </div>
  );
}
