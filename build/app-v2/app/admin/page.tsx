// Admin (§8.5): Faqja Gati pages with status and "Shëno të paguar", plus a business overview.
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import Admin from '@/components/Admin';
import AdminUnlock from '@/components/AdminUnlock';
import { ADMIN_COOKIE, adminUnlocked } from '@/lib/adminAuth';
import { SESSION_COOKIE } from '@/lib/auth';
import { config } from '@/lib/config';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.admin.pageTitle, robots: { index: false, follow: false } };

export default async function AdminPage() {
  const { user, business } = await getSession();
  if (user?.role !== 'admin') {
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
  return <Admin hasBusiness={!!business} priceCents={config.pagePriceCents()} />;
}
