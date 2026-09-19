'use client';
import React, { useEffect, useState } from 'react';
import { useMerek } from '@/lib/merek';

/**
 * Kotak logo platform. Menampilkan gambar kalau merek punya logoUrl, dan
 * ikon gedung bawaan kalau belum - jadi platform tidak pernah tampil tanpa
 * logo hanya karena gambarnya belum diunggah.
 *
 * Warnanya ikut merek, bukan kelas Tailwind tetap, supaya bisa diganti dari
 * Admin Panel tanpa deploy.
 */
export function LogoMerek({
  ukuran = 'md',
  gaya = 'penuh',
  className = '',
}: {
  /** sm = 36px (ponsel), md = 48px (header), lg = 40px (panel login). */
  ukuran?: 'sm' | 'md' | 'lg';
  /** penuh = kotak berwarna; tembus = latar putih transparan (di atas gambar). */
  gaya?: 'penuh' | 'tembus';
  className?: string;
}) {
  const merek = useMerek();
  /*
    Gambar yang GAGAL dimuat harus jatuh ke ikon bawaan, bukan ke gambar
    rusak bawaan peramban.

    Ini bukan penjagaan teoretis. merek.logoUrl untuk render PERTAMA diambil
    dari sessionStorage (lihat lib/merek.ts) - salinan merek dari kunjungan
    sebelumnya, yang bisa memuat URL Supabase Storage dari logo yang sejak itu
    sudah diganti atau dihapus. URL itu 404, peramban menggambar ikon sobek,
    lalu beberapa ratus milidetik kemudian muatMerek() selesai dan logo yang
    benar muncul. Persis "sesekali error, harus di-refresh".

    Kuncinya di-reset tiap kali URL-nya berubah - kalau tidak, satu kegagalan
    akan menyembunyikan logo baru yang sebenarnya sehat.
  */
  const [gagal, setGagal] = useState(false);
  useEffect(() => { setGagal(false); }, [merek.logoUrl]);

  const sisi = ukuran === 'sm' ? 36 : ukuran === 'lg' ? 40 : 48;
  const ikon = Math.round(sisi * 0.52);

  /*
    Ada logo -> kotaknya PUTIH, bukan gradasi warna merek.

    Gradasi itu dulu benar karena isinya ikon garis putih. Begitu logo
    sungguhan dipasang, gradasi jadi latar yang bertabrakan: lambang WorkFlow
    biru di atas gradasi merah tidak pernah bisa terbaca, dan logo unggahan
    admin mana pun punya masalah yang sama - pembuat logo merancangnya untuk
    latar terang, bukan untuk warna apa pun yang kebetulan dipilih di Admin
    Panel. Varian 'tembus' (di atas foto login) tetap dibedakan: di sana
    putihnya ditipiskan supaya fotonya masih terasa.
  */
  const adaLogo = Boolean(merek.logoUrl) && !gagal;
  const latar = gaya === 'tembus'
    ? (adaLogo
        ? { background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }
        : { background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' })
    : (adaLogo
        ? { background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }
        : { background: `linear-gradient(135deg, ${merek.warnaUtama}, ${merek.warnaUtama2})` });

  return (
    <div
      className={`rounded-xl shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      style={{ width: sisi, height: sisi, ...latar }}
    >
      {adaLogo ? (
        // Sengaja <img>, bukan next/image: sumbernya URL yang diisi pengguna
        // saat berjalan, sementara next/image butuh domainnya terdaftar lebih
        // dulu di next.config - logo baru akan gagal dimuat sampai deploy.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={merek.logoUrl} alt={merek.namaPerusahaan} width={sisi} height={sisi}
          decoding="async" onError={() => setGagal(true)}
          className="w-full h-full object-contain p-[11%]" />
      ) : (
        <svg aria-hidden="true" focusable="false" style={{ width: ikon, height: ikon }} className="text-white"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )}
    </div>
  );
}
