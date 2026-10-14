import type { Metadata } from 'next';

//  Halaman customer: judul tab diganti judul kelas oleh halaman itu sendiri (tanpa nama platform).
//  `absolute`: tanpa akhiran nama platform dari template judul di app/layout.tsx (juga yang terbaca
//  pratinjau link di WhatsApp).
export const metadata: Metadata = {
  title: { absolute: 'Kelas Online' },
  description: 'Quiz online - cukup isi nama untuk mulai.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
