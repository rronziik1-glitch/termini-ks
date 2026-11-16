// Faqja Gati wizard (§6.1 steps 2–4). Logged-in Termini owners start prefilled from their business.
import type { Metadata } from 'next';
import FaqjaWizard from '@/components/FaqjaWizard';
import { CATEGORY_TEMPLATE } from '@/lib/fg/schema';
import { nationalPart as displayPhone } from '@/lib/phone';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.fg.pageTitle, robots: { index: false } };

export default async function FaqjaCreate() {
  const { user, business } = await getSession();
  const prefill = business
    ? {
        name: business.name, city: business.city, template: CATEGORY_TEMPLATE[business.category] || 'auto',
        phone: displayPhone(business.phone), text: business.description || '',
      }
    : { name: '', city: '', template: '', phone: user ? displayPhone(user.phone) : '', text: '' };
  return <FaqjaWizard prefill={prefill} />;
}
