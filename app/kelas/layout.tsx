import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Kelas Online' },
  description: 'Quiz online - cukup isi nama untuk mulai.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
