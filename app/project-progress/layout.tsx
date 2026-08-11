import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans', display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['400', '500', '600'],
  variable: '--font-plex-mono', display: 'swap',
});

/**
 * IBM Plex Sans/Mono di-scope ke modul Project Progress saja — bagian dari
 * pergantian bahasa visual dari "foto latar + kartu kaca" ke "kertas netral +
 * angka monospace" (lihat PALETTE di _components/shared.ts). Modul lain di
 * platform tidak disentuh oleh perubahan ini.
 */
export default function ProjectProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plexSans.variable} ${plexMono.variable}`} style={{ fontFamily: 'var(--font-plex-sans)' }}>
      {children}
    </div>
  );
}
