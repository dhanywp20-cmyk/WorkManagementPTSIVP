import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Project Progress' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
