// v6: always obvious who is logged in, and one tap to switch view.
//   Super Admin → "Super Admin · Roni"   [Paneli] [Biznesi im] [Gjej një termin]
//   Business    → "Biznes · Berberi Arti" [Kalendari] [Faqja ime si klient]
//   Customer    → "Klient · 049 555 666"  [Rezervimet e mia]
// Nobody logged in → nothing is shown. `where` says which kind of page it sits on, so the bar can say
// "you are seeing this as a customer" on public pages and highlight the place you are in.
import Link from 'next/link';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/auth';
import { CLIENT_COOKIE, clientPhone } from '@/lib/client-session';
import { displayPhone } from '@/lib/phone';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

const t = sq.account;

export default async function AccountBar({ where }: { where: 'public' | 'app' | 'admin' }) {
  const [{ user, business }, jar] = await Promise.all([getSession(), cookies()]);
  const client = clientPhone(jar.get(CLIENT_COOKIE)?.value);
  const admin = isSuperAdmin(user);
  if (!user && !client) return null;

  type L = { href: string; label: string; here?: boolean };
  let role: 'admin' | 'owner' | 'client';
  let name: string;
  const links: L[] = [];
  if (admin) {
    role = 'admin'; name = user!.name || displayPhone(user!.phone);
    links.push({ href: '/admin', label: t.panel, here: where === 'admin' });
    if (business) links.push({ href: '/app', label: t.myBusiness, here: where === 'app' });
    links.push({ href: '/gjej', label: t.asClient, here: where === 'public' });
  } else if (user && business) {
    role = 'owner'; name = business.name;
    links.push({ href: '/app', label: t.calendar, here: where === 'app' });
    links.push({ href: `/b/${business.slug}`, label: t.myPage, here: false });
  } else if (user) {
    role = 'owner'; name = user.name || displayPhone(user.phone);
    links.push({ href: '/fillo', label: t.finishSetup });
  } else {
    role = 'client'; name = displayPhone(client);
    links.push({ href: '/rezervimet', label: t.myBookings });
  }
  const viewingAsClient = where === 'public' && role !== 'client';

  return (
    <div className={`acct acct--${role}`} role="region" aria-label={t.label}>
      <div className="acct__in">
        <span className="acct__who">
          <span className="acct__badge">{t.role[role]}</span>
          <span className="acct__name">{name}</span>
          {viewingAsClient && <span className="acct__hint">{t.viewingAsClient}</span>}
        </span>
        <nav className="acct__links" aria-label={t.label}>
          {links.filter((l) => !l.here).map((l) => <Link key={l.href} href={l.href} className="acct__link">{l.label}</Link>)}
        </nav>
      </div>
    </div>
  );
}
