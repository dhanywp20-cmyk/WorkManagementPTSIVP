import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PwaBootstrap } from '@/components/shared';

export const metadata: Metadata = {
  title: 'Dashboard PTS IVP - IndoVisual',
  description: 'Portal Terpadu Support IndoVisual',
  // TIDAK perlu field `manifest` di sini - app/manifest.ts (konvensi khusus
  // Next.js App Router) sudah otomatis disajikan di /manifest.webmanifest
  // DAN otomatis disisipkan sebagai <link rel="manifest"> oleh Next.js
  // sendiri. Menambahkannya lagi di sini akan dobel.
  appleWebApp: {
    // iOS Safari tidak baca manifest.json untuk mode "Tambah ke Layar Utama" -
    // meta tag Apple sendiri yang menentukan judul & mode tampilan di sana.
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PTS Portal',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximumScale TIDAK dipaku ke 1 lagi: itu mematikan zoom cubit - orang
  // yang butuh memperbesar tulisan tidak bisa sama sekali (WCAG 1.4.4).
  // Zoom otomatis iOS saat mengetik dicegah dengan cara yang benar: font
  // isian >= 16px di layar ponsel (lihat globals.css).
  themeColor: '#e11d48',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">
        <PwaBootstrap />
        {children}
        {/*
          DI SINI DULU ADA SUNTIKAN CSS — SENGAJA DIHAPUS, JANGAN DIKEMBALIKAN.

          Isinya satu baris:
              .fixed.inset-0 > * { max-height: 85vh !important; overflow-y: auto !important }
          dipasang lewat <script> dan HANYA jalan bila halaman berada di dalam
          iframe (window.parent !== window).

          Dua sifat itu membuatnya nyaris mustahil ditemukan. Ia tidak ada di
          berkas CSS mana pun, jadi tidak muncul saat menelusuri kode gaya; dan
          ia tidak aktif saat modul dibuka langsung, hanya saat dibuka dari
          dashboard — persis kondisi yang dipakai sehari-hari.

          Akibatnya: KARTU setiap modal di SELURUH platform dipaksa berhenti di
          85% tinggi layar. !important mengalahkan segalanya, termasuk style
          inline, sehingga berapa pun tinggi yang disetel di komponen tidak
          pernah berlaku. Pada layar 857px hasilnya 728px — dan itu sisa ruang
          kosong yang terlihat di bawah modal.

          Aturan ini lahir sebagai penambal ketika area modul di dashboard masih
          memakai overflow-y-auto, sehingga iframe bisa lebih tinggi dari yang
          terlihat dan modal terpotong di atas. Sebab itu sudah dibereskan di
          tempat yang benar: area modul kini dikunci persis setinggi layar.
          Penambalnya tinggal jadi penyakitnya sendiri.
        */}
      </body>
    </html>
  );
}
