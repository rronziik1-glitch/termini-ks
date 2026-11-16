// /faqja/{id}: progress → watermarked preview → payment → waiting for payment → live (§6.1 steps 5–8).
// The id is unguessable; it is the only key to the preview.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FaqjaView from '@/components/FaqjaView';
import { config, livePageUrl, pagesHostSuffix } from '@/lib/config';
import { db } from '@/lib/db';
import { MAX_REVISIONS, refreshExpiry } from '@/lib/pages';
import { paysera } from '@/lib/payments';
import { getOrigin, getSession } from '@/lib/session';
import { sq } from '@/lib/sq';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await db.page.findUnique({ where: { id: (await params).id }, select: { inputName: true } });
  return { title: p ? sq.fg.previewTitle(p.inputName) : sq.fg.notFoundTitle, robots: { index: false, follow: false } };
}

export default async function FaqjaPage({ params, searchParams }: Props) {
  const [{ id }, q, origin, { business: ownBusiness }] = await Promise.all([params, searchParams, getOrigin(), getSession()]);
  const row = await db.page.findUnique({ where: { id } });
  if (!row) notFound();
  const page = await refreshExpiry(row);
  const [business, pending] = await Promise.all([
    page.businessId ? db.business.findUnique({ where: { id: page.businessId }, select: { slug: true, bookingsPaused: true } }) : null,
    db.payment.findFirst({ where: { pageId: id, status: 'pending' }, orderBy: { createdAt: 'desc' } }),
  ]);
  const bank = config.bank();
  return (
    <FaqjaView
      initialStep={q.hapi === 'pagesa' ? 'pay' : ''}
      page={{
        id: page.id, status: page.status, name: page.inputName, city: page.inputCity, template: page.template, text: page.inputText,
        themeVariant: page.themeVariant, revisionsLeft: Math.max(0, MAX_REVISIONS - page.revisionsUsed), notice: page.notice,
        subdomain: page.subdomain || '', customDomain: page.customDomain || '', updatedAt: page.updatedAt.getTime(),
        liveUrl: page.subdomain ? livePageUrl(page.subdomain, origin) : '',
        termini: business && !business.bookingsPaused ? business.slug : '',
        loggedInBusiness: !!ownBusiness,
      }}
      payment={pending ? { method: pending.method, reference: pending.reference, amountCents: pending.amountCents } : null}
      settings={{
        priceCents: config.pagePriceCents(), domainCents: config.domainPriceCents(), payseraOn: paysera.configured(),
        bank: { iban: bank.iban, name: bank.name, holder: bank.holder }, supportWa: config.supportWhatsapp(), supportName: config.supportName(),
        hostSuffix: pagesHostSuffix(),
      }}
    />
  );
}
