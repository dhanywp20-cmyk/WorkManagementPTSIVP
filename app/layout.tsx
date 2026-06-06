import './globals.css';
import type { Viewport } from 'next';

export const metadata = {
  title: 'Dashboard PTS IVP - IndoVisual',
  description: 'Portal Terpadu Support IndoVisual',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
