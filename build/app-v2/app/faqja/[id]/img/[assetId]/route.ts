// Preview photos: only the watermarked, low-resolution derivative is ever served here.
import { imageResponse } from '@/lib/fg/serve';
import { previewAssetKey } from '@/lib/pages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  return imageResponse(await previewAssetKey(id, assetId), 'private');
}
