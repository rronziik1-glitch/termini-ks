// The watermarked preview HTML that the /faqja/{id} screen shows in its frame. Always the preview path.
import { previewHtml } from '@/lib/pages';
import { errorPage, htmlResponse } from '@/lib/fg/serve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return htmlResponse(await previewHtml((await params).id), 'preview');
  } catch (e) {
    return errorPage(e);
  }
}
