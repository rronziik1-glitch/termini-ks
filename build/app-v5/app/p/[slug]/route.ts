// Published Faqja Gati page (later {subdomain}.faqjagati.com). 404 unless the page is live: the payment gate.
import { liveHtml } from '@/lib/pages';
import { htmlResponse, notFoundPage } from '@/lib/fg/serve';
import { requestOrigin } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const html = await liveHtml((await params).slug, requestOrigin(req));
  return html ? htmlResponse(html, 'live') : notFoundPage();
}
