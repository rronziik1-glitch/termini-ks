// Settings sub-screens: /app/cilesimet/orari · /rezervimet · /profili
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Settings, { type SettingsView } from '@/components/Settings';
import { getOrigin, getSession } from '@/lib/session';
import { settingsData } from '@/lib/settings-data';
import { sq } from '@/lib/sq';

const VIEWS: SettingsView[] = ['orari', 'rezervimet', 'profili'];
const TITLES: Record<string, string> = { orari: sq.settings.hours, rezervimet: sq.settings.rules, profili: sq.settings.profile };
type Props = { params: Promise<{ view: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { business } = await getSession();
  return { title: `${TITLES[(await params).view] || sq.settings.title} · ${business?.name || 'Termini'}` };
}

export default async function SettingsSubPage({ params }: Props) {
  const view = (await params).view as SettingsView;
  if (!VIEWS.includes(view)) notFound();
  const [{ user, business }, origin] = await Promise.all([getSession(), getOrigin()]);
  return <Settings view={view} data={await settingsData(user!, business!, origin)} />;
}
