'use client';

/**
 * Kartu ringkasan angka (Total / Pending / Selesai / dst) yang dipakai di
 * hampir semua modul.
 *
 * Sebelumnya tiap modul menyalin markup-nya sendiri: kotak gradien jenuh
 * dengan angka putih. Dua masalah muncul dari situ. Pertama, deretan kartu
 * gradien berdiri sejajar dan sama-sama menuntut perhatian, sehingga tidak ada
 * hierarki dan angka antar-kartu justru sulit dibandingkan. Kedua, karena
 * disalin per modul, gayanya perlahan menyimpang satu sama lain.
 *
 * Komponen ini menyatukannya: permukaan putih, angka gelap, dan warna dipakai
 * sebagai PENANDA kategori lewat pita tipis di tepi kiri — bukan untuk mengecat
 * seluruh kartu. Hanya kartu yang sedang dipakai sebagai filter yang
 * ditonjolkan.
 */

import React from 'react';

/**
 * Campur warna dengan putih dan kembalikan warna SOLID.
 *
 * Penting: latar kartu aktif TIDAK boleh memakai rgba semi-transparan.
 * Halaman-halaman modul memakai foto sebagai latar, dan warna tembus pandang
 * membuat foto itu terlihat menembus kartu — hasilnya terlihat seperti kaca
 * buram dan angkanya jadi sulit dibaca. Dengan mencampur ke putih di sini,
 * warnanya tetap lembut tapi kartunya benar-benar pekat.
 */
function campurPutih(hex: string, kadar: number): string {
  const h = hex.replace('#', '');
  const utuh = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(utuh.slice(0, 2), 16);
  const g = parseInt(utuh.slice(2, 4), 16);
  const b = parseInt(utuh.slice(4, 6), 16);
  const c = (v: number) => Math.round(v * kadar + 255 * (1 - kadar));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export interface StatCardItem {
  label: string;
  value: React.ReactNode;
  /** Baris keterangan kecil di bawah label. */
  sub?: string;
  /** Warna penanda kategori — dipakai untuk pita tepi & penonjolan saat aktif. */
  accent: string;
  /** Diisi bila kartu berfungsi sebagai tombol filter. */
  onClick?: () => void;
  /** Kartu ini sedang dipakai sebagai filter. */
  active?: boolean;
}

export function StatCard({ label, value, sub, accent, onClick, active = false }: StatCardItem) {
  const bisaDiklik = typeof onClick === 'function';

  const isi = (
    <>
      {/* Pita aksen: penanda kategori yang tetap terbaca tanpa mendominasi kartu. */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent, opacity: active ? 1 : 0.55 }} />
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-black leading-none tabular-nums" style={{ color: active ? accent : '#0f172a' }}>
          {value}
        </span>
        {active && (
          <span className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: accent }}>
            Aktif
          </span>
        )}
      </div>
      <div>
        <p className="text-[13px] font-bold leading-tight" style={{ color: active ? accent : '#1e293b' }}>{label}</p>
        {sub && <p className="text-[10px] font-medium leading-tight text-slate-500">{sub}</p>}
      </div>
    </>
  );

  const gaya: React.CSSProperties = {
    // Selalu warna PEKAT — lihat catatan di campurPutih().
    background: active ? campurPutih(accent, 0.10) : '#ffffff',
    border: `1px solid ${active ? accent : 'rgba(15,23,42,0.10)'}`,
    boxShadow: active ? `0 0 0 1px ${accent}` : '0 1px 2px rgba(15,23,42,0.06)',
  };

  const kelasDasar = 'relative overflow-hidden rounded-xl px-4 py-3.5 flex flex-col gap-1.5';

  // Kartu yang bisa diklik HARUS berupa <button>: ini kontrol filter, jadi wajib
  // bisa dicapai lewat keyboard dan punya cincin fokus. Kartu yang hanya
  // menampilkan angka tetap <div> supaya tidak masuk urutan Tab tanpa guna.
  if (!bisaDiklik) {
    return <div className={kelasDasar} style={gaya}>{isi}</div>;
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={`Filter: ${label}`}
      className={`${kelasDasar} text-left cursor-pointer select-none transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
      style={gaya}>
      {isi}
    </button>
  );
}

/** Pembungkus grid agar jarak & jumlah kolom seragam antar modul. */
export function StatCardGrid({ items, cols = 4, className = '' }: {
  items: StatCardItem[];
  /** Jumlah kolom di layar sedang ke atas. Di ponsel selalu 2 kolom. */
  cols?: 3 | 4 | 5 | 6;
  className?: string;
}) {
  const kolom = { 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6' }[cols];
  return (
    <div className={`grid grid-cols-2 ${kolom} gap-3 ${className}`}>
      {items.map((it, i) => <StatCard key={`${it.label}-${i}`} {...it} />)}
    </div>
  );
}
