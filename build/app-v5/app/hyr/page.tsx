import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Login from '@/components/Login';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.login.title, robots: { index: false } };

/** Only same-site paths are accepted as a return address. */
const safeNext = (v: unknown) => (typeof v === 'string' && /^\/[a-z0-9\-/_?=&]*$/i.test(v) && !v.startsWith('//') ? v : '');

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  const { user, business } = await getSession();
  if (user) redirect(next || (business ? '/app' : user.role === 'admin' ? '/admin' : '/fillo'));
  return <Login next={next} />;
}
