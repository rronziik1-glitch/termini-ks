// v5: Termini launches first (Dec 2026). Faqja Gati is switched OFF until it opens (April/May 2027).
// Turn it on with FAQJA_GATI_ENABLED=1 in .env / Vercel. Works in the edge middleware too (no imports).
export const faqjaGatiOn = () => ['1', 'true', 'yes'].includes((process.env.FAQJA_GATI_ENABLED || '').trim().toLowerCase());

/** Paths that belong to Faqja Gati only. */
export const FG_PATHS = ['/faqja', '/p', '/fg', '/api/pages'];
export const isFgPath = (pathname: string) => FG_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
