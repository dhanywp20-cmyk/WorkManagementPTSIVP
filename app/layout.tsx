import './globals.css';
import './tema-gelap.css';
import './tema-gelap-kaca.css';
import './tema-gelap-kontras.css';
import './tema-pts-kaca.css';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { PwaBootstrap, PembaruanAndroid, PantauVersiWeb, PenjagaGalatTulis, PenjagaDialog, PelaporGalat } from '@/components/shared';
import { PenyelarasTema, SKRIP_TEMA_AWAL } from '@/components/shared/Tema';

const hurufPts = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-pts', display: 'swap' });

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_AWAL }} />
      </head>
      <body className={`antialiased ${hurufPts.variable}`}>
        <PenyelarasTema />
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
