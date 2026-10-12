import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AV Solutions Studio' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
