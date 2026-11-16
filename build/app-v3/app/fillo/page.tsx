// Business sign-up: 2 minutes, 4 steps (01-product-design.md §4.1).
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Onboarding from '@/components/Onboarding';
import { CATEGORIES } from '@/lib/business';
import { displayLink } from '@/lib/config';
import { displayPhone } from '@/lib/phone';
import { getOrigin, getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.onboarding.pageTitle, description: sq.home.description };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [q, { user, business }, origin] = await Promise.all([searchParams, getSession(), getOrigin()]);
  if (business) redirect('/app');
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return (
    <Onboarding
      linkPrefix={displayLink('', origin).prefix}
      user={user ? { name: user.name, phone: displayPhone(user.phone) } : null}
      prefill={{ name: str(q.emri, 60), city: sq.cities.includes(str(q.qyteti, 40)) ? str(q.qyteti, 40) : '', category: CATEGORIES.includes(str(q.lloji, 20)) ? str(q.lloji, 20) : '' }}
    />
  );
}
