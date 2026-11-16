// Full-quality photos of a live page; 404 for anything that is not live.
import { imageResponse } from '@/lib/fg/serve';
import { liveAssetKey } from '@/lib/pages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; assetId: string }> }) {
  const { slug, assetId } = await params;
  return imageResponse(await liveAssetKey(slug, assetId), 'public');
}
