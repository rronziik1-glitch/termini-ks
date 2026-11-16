// Every /api/* request goes through the small router in lib/http.ts.
// The route tables live in lib/api/*.ts (paths as in fable/01-product-design.md §8).
import '@/lib/api/public';
import '@/lib/api/owner';
import '@/lib/api/pages';
import { dispatch } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Building a page (AI call + photos) runs after the response; give the function time on Vercel.
export const maxDuration = 60;

type Params = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: Params) => dispatch(req, (await params).path);

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
