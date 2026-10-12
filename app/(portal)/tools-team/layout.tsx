import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AV Solution Tools' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
