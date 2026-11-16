import type { Metadata } from 'next';
import Services from '@/components/Services';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getSession();
  return { title: sq.services.pageTitle(business?.name || 'Termini') };
}

export default async function ServicesPage() {
  const { business } = await getSession();
  return <Services slug={business!.slug} />;
}
