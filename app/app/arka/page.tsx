// v7 owner "Arka": what Termini brought this month, the messages to send, today's Instagram Story, and the money book.
import type { Metadata } from 'next';
import Arka from '@/components/Arka';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getSession();
  return { title: sq.g.arkaPageTitle(business?.name || 'Termini') };
}

export default async function ArkaPage() {
  const { business } = await getSession();
  return <Arka bizName={business!.name} slug={business!.slug} />;
}
