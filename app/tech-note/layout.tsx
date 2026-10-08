import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tech Note' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
