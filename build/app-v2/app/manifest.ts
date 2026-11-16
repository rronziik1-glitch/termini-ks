import type { MetadataRoute } from 'next';
import { sq } from '@/lib/sq';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Termini',
    short_name: 'Termini',
    description: sq.home.description,
    lang: 'sq',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0c0c0d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
