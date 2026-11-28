// /sitemap.xml: the public pages, every listed business booking page and every published Faqja Gati page.
import type { MetadataRoute } from 'next';
import { bookingUrl, config, livePageUrl } from '@/lib/config';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { TEMPLATES } from '@/lib/fg/schema';
import { faqjaGatiOn } from '@/lib/features';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.appUrl();
  const out: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/gjej`, changeFrequency: 'daily', priority: 0.8 },
  ];
  const fg = faqjaGatiOn();
  if (fg) out.push({ url: `${base}/faqja`, changeFrequency: 'weekly', priority: 0.9 }, ...TEMPLATES.map((t) => ({ url: `${base}/faqja/shembull/${t}`, changeFrequency: 'monthly' as const, priority: 0.4 })));
  if ((process.env.SITE_PASSWORD || '').trim()) return out.slice(0, 1);
  try {
    const [businesses, pages] = await Promise.all([
      db.business.findMany({ where: { listedInFind: true, suspendedAt: null, isDemo: false, onboardedAt: { not: null } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5000 }),
      db.page.findMany({ where: { status: 'live', subdomain: { not: null } }, select: { subdomain: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5000 }),
    ]);
    for (const b of businesses) out.push({ url: bookingUrl(b.slug, base), lastModified: b.updatedAt, changeFrequency: 'weekly', priority: 0.7 });
    if (fg) for (const p of pages) out.push({ url: livePageUrl(p.subdomain!, base), lastModified: p.updatedAt, changeFrequency: 'monthly', priority: 0.6 });
  } catch (e) {
    log.error('sitemap.failed', { error: String(e) });
  }
  return out;
}
