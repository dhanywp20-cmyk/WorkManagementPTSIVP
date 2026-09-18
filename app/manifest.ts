import type { MetadataRoute } from 'next';
import { bacaMerekUntukManifest } from '@/lib/merek-server';

/**
 * Manifest PWA - dibuat DINAMIS (bukan public/manifest.json statis) supaya
 * nama & warna platform ikut pengaturan merek dari Admin Panel, bukan
 * dipaku ke satu company. Ikonnya sendiri masih berkas statis di
 * public/icons/ - lihat catatan di lib/merek-server.ts kenapa itu belum
 * ikut dinamis (butuh pipeline pengubahan ukuran logo unggahan admin
 * menjadi ukuran ikon PWA yang sah, di luar cakupan perubahan ini).
 */
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
