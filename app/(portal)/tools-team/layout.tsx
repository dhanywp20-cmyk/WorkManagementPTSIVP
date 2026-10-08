import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tools Team' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
