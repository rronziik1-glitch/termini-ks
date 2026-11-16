import type { Metadata } from 'next';
import Customers from '@/components/Customers';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getSession();
  return { title: sq.customers.pageTitle(business?.name || 'Termini') };
}

export default function CustomersPage() {
  return <Customers />;
}
