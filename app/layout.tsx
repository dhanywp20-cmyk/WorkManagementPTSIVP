import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PwaBootstrap, PembaruanAndroid, PantauVersiWeb, PenjagaGalatTulis, PenjagaDialog, PelaporGalat } from '@/components/shared';

export const metadata: Metadata = {
  title: { default: 'Dashboard PTS IVP - IndoVisual', template: '%s · PTS IVP' },
  description: 'Portal Terpadu Support IndoVisual',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PTS Portal',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e11d48',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased">
        <PwaBootstrap />
        <PenjagaGalatTulis />
        <PelaporGalat />
        <PenjagaDialog />
        <PembaruanAndroid />
        <PantauVersiWeb />
        {children}
      </body>
    </html>
  );
}
