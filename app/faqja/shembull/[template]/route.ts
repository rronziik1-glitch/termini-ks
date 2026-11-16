// Example pages on /faqja: each template filled with Fable's demo content, rendered on the preview path.
import { demoContent, renderExample } from '@/lib/fg/render';
import { isTemplate } from '@/lib/fg/schema';
import { htmlResponse, notFoundPage } from '@/lib/fg/serve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  if (!isTemplate(template)) return notFoundPage();
  return htmlResponse(renderExample(demoContent(template)), 'preview');
}
