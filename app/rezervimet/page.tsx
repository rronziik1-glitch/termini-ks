// v6 "Rezervimet e mia" for customers (no account): phone + login code → every booking made with that number.
import type { Metadata } from 'next';
import AccountBar from '@/components/AccountBar';
import { cookies } from 'next/headers';
import MyBookings from '@/components/MyBookings';
import { CLIENT_COOKIE, clientBookings, clientPhone } from '@/lib/client-session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: sq.my.pageTitle, robots: { index: false, follow: false } };

export default async function MyBookingsPage() {
  const phone = clientPhone((await cookies()).get(CLIENT_COOKIE)?.value);
  const initial = phone ? await clientBookings(phone) : null;
  return <><AccountBar where="public" /><MyBookings initial={initial} /></>;
}
