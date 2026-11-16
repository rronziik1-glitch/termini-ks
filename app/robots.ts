// /robots.txt. While SITE_PASSWORD is set (private launch) search engines are told to stay out completely.
import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if ((process.env.SITE_PASSWORD || '').trim()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // Private areas, the API, unpaid previews and personal booking links are never indexed.
      disallow: ['/app', '/admin', '/api/', '/hyr', '/fillo', '/site-password', '/faqja/krijo', '/faqja/*/parapamja', '/faqja/*/img/', '/b/*/t/'],
    }],
    sitemap: `${config.appUrl()}/sitemap.xml`,
    host: config.appUrl(),
  };
}
