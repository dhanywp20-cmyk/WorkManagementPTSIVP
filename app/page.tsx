import { redirect } from 'next/navigation';

/**
 * Alamat akar langsung dialihkan oleh server ke /dashboard (layar login / portal).
 * Dulu halaman klien yang menunggu JavaScript termuat lalu baru berpindah - 2,5 dtk saat dingin.
 */
export default function Home() {
  redirect('/dashboard');
}
