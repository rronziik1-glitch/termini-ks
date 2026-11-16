// Audit check: does a business name with "</script>" break out of the JSON-LD block on the live page?
// Run from build/app:  npx tsx ../../fable/_audit/xss-check.ts
import { demoContent, renderLive, renderPreview } from '../../build/app/lib/fg/render';

const c = demoContent('berber');
c.brand.name = 'Arti</script><script>alert(1)</script>';
const live = renderLive(c);
const prev = renderPreview(c);
const hit = (h: string) => /<script>alert\(1\)<\/script>/.test(h);
console.log('live breaks out:', hit(live));
console.log('preview breaks out:', hit(prev));
