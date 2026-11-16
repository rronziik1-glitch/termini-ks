import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Settings from '@/components/Settings';
import { getOrigin, getSession } from '@/lib/session';
import { settingsData } from '@/lib/settings-data';
import { sq } from '@/lib/sq';

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getSession();
  return { title: sq.settings.pageTitle(business?.name || 'Termini') };
}

export default async function SettingsPage() {
  const [{ user, business }, origin] = await Promise.all([getSession(), getOrigin()]);
  // The layout redirects too, but pages render in parallel with it: never touch a missing session here.
  if (!user) redirect('/hyr?next=/app');
  if (!business) redirect(user.role === 'admin' ? '/admin' : '/fillo');
  return <Settings view="main" data={await settingsData(user!, business!, origin)} />;
}
