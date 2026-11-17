// v6 Super Admin panel (§8.5): overview, every business (read-only view, suspend), audit log, Faqja Gati pages.
import type { Metadata } from 'next';
import AccountBar from '@/components/AccountBar';
import Link from 'next/link';
import { cookies } from 'next/headers';
import SuperAdmin from '@/components/SuperAdmin';
import AdminUnlock from '@/components/AdminUnlock';
import { ADMIN_COOKIE, adminUnlocked } from '@/lib/adminAuth';
import { SESSION_COOKIE, isSuperAdmin } from '@/lib/auth';
import { config } from '@/lib/config';
import { faqjaGatiOn } from '@/lib/features';
import { displayPhone } from '@/lib/phone';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Super Admin · Termini', robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const { user, business } = await getSession();
  if (!isSuperAdmin(user)) {
    return (
      <div className="page page--subtle"><div className="app"><main className="app__pad">
        <section className="card empty" style={{ marginTop: 48 }}>
          <p className="empty__title">{sq.admin.onlyAdmin}</p>
          <Link className="btn btn--primary" href="/hyr?next=/admin">{sq.admin.loginAsAdmin}</Link>
        </section>
      </main></div></div>
    );
  }
  const jar = await cookies();
  if (!adminUnlocked(jar.get(SESSION_COOKIE)?.value, jar.get(ADMIN_COOKIE)?.value)) return <AdminUnlock />;
  return <><AccountBar where="admin" /><SuperAdmin hasBusiness={!!business} priceCents={config.pagePriceCents()} faqjaGati={faqjaGatiOn()} adminName={user!.name || displayPhone(user!.phone)}
    initialTab={typeof q.tab === 'string' ? q.tab : ''} initialBiz={typeof q.biznes === 'string' ? q.biznes : ''} /></>;
}
