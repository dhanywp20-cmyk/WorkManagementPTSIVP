import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Form Review' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
