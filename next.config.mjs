/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // jsdom renders the Faqja Gati templates on the server; sharp makes the watermarked previews.
  serverExternalPackages: ['jsdom', 'sharp', '@prisma/client'],
  // No ESLint dependency in this project; `npm run typecheck` and the tests are the gate.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: import.meta.dirname,
  // The Faqja Gati templates (HTML, fg.js, schema) are read from disk at request time, so they must be
  // shipped with every server function when the app runs on Vercel.
  outputFileTracingIncludes: { '/*': ['./templates/**/*'], '/**/*': ['./templates/**/*'] },
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
        : []),
    ];
    return [
      { source: '/:path*', headers: [...base, { key: 'X-Frame-Options', value: 'DENY' }] },
      // The Faqja Gati preview is shown in an iframe on our own pages (later rule wins for the same header).
      { source: '/faqja/:id/parapamja', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

export default nextConfig;
