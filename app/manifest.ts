import type { MetadataRoute } from 'next';
import { bacaMerekUntukManifest } from '@/lib/merek/server';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const m = await bacaMerekUntukManifest();
  return {
    name: m.namaPlatform,
    short_name: m.namaPlatformSingkat,
    description: `${m.namaPlatform} - dipasang sebagai aplikasi di HP untuk notifikasi & akses lebih cepat.`,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: m.warnaUtama,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
