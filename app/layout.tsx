import './globals.css';

export const metadata = {
  title: 'Dashboard PTS IVP - IndoVisual',
  description: 'Portal Terpadu Support IndoVisual',
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
