'use client';

import React from 'react';

/**
 * MobileListCard - kartu daftar untuk tampilan MOBILE, pola acuan dari
 * Ticket Troubleshooting: header (judul + badge status di kanan), meta
 * (lokasi/tanggal), grid 2-kolom label:value, lalu baris ikon aksi.
 *
 * Dipakai agar SEMUA platform punya gaya kartu mobile yang sama. Bungkus dalam
 * `<div className="md:hidden bg-gray-50/70 p-2.5 space-y-2.5">` dan sembunyikan
 * tabel desktop dengan `hidden md:block` - TIDAK menyentuh tampilan desktop
 * sama sekali, keduanya cabang terpisah lewat Tailwind responsive prefix.
 *
 * Sebelumnya baris-baris ini rata dengan latar (divide-y tipis antar baris,
 * tanpa jarak/elevasi) - terlihat seperti daftar spreadsheet yang dipadatkan,
 * bukan kartu aplikasi mobile yang lazim (kartu terangkat dengan jarak &
 * bayangan tipis di atas kanvas abu-abu, ikon kategori di kiri, blok detail
 * yang disekat dari header). Diseragamkan ke bentuk itu di sini SEKALI -
 * otomatis berlaku ke 8 modul yang memakai komponen ini.
 */

export interface MobileCardField {
  label: string;
  value: React.ReactNode;
  span2?: boolean;          // ambil 2 kolom penuh
  valueClass?: string;      // override warna/teks nilai
  hide?: boolean;           // lewati kalau kosong
}

interface MobileListCardProps {
  title: React.ReactNode;
  titlePrefix?: React.ReactNode;   // mis. ikon  di depan judul
  meta?: React.ReactNode;          // baris kecil di bawah judul (lokasi/tanggal)
  badges?: React.ReactNode;        // badge status di kanan atas (boleh beberapa, stacked)
  fields?: MobileCardField[];      // pasangan label:value (grid 2 kolom)
  actions?: React.ReactNode;       // baris tombol/ikon aksi
  accent?: string;                 // warna garis kiri (mis. merah utk overdue)
  highlight?: boolean;             // latar sorot (mis. overdue)
  onClick?: () => void;            // klik kartu (mis. buka detail)
}

export function MobileListCard({
  title, titlePrefix, meta, badges, fields, actions, accent, highlight, onClick,
}: MobileListCardProps) {
  const visibleFields = (fields ?? []).filter(f => !f.hide);
  return (
    // Kartu yang bisa diklik harus bisa dicapai keyboard juga. Sebuah <div>
    // ber-onClick TIDAK masuk urutan Tab dan tidak menanggapi Enter/Spasi:
    // bagi yang tidak memakai tetikus, detail baris ini sama sekali tidak
    // terbuka. Bentuknya tetap <div> karena kartunya memuat tombol aksi di
    // dalamnya, dan <button> di dalam <button> tidak sah.
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Spasi kalau tidak dicegah akan menggulir halaman, bukan membuka kartu.
          e.preventDefault();
          onClick();
        }
      } : undefined}
      className={`rounded-2xl px-3.5 py-3 border shadow-sm transition-all ${
        highlight ? 'bg-red-50/70 border-red-100' : 'bg-white border-gray-100'
      } ${onClick ? 'active:scale-[0.985] active:shadow-none cursor-pointer' : ''}`}
      style={accent ? { borderLeftWidth: 4, borderLeftColor: accent } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {titlePrefix}
            <p className="font-bold text-[13.5px] text-gray-800 leading-tight break-words">{title}</p>
          </div>
          {meta && <div className="text-[11px] text-gray-400 mt-1 space-y-0.5">{meta}</div>}
        </div>
        {badges && <div className="flex flex-col items-end gap-1 shrink-0">{badges}</div>}
      </div>

      {visibleFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 p-2.5 rounded-xl bg-gray-50/80 text-xs">
          {visibleFields.map((f, i) => (
            <div key={i} className={`truncate ${f.span2 ? 'col-span-2' : ''}`}>
              <span className="text-gray-400">{f.label}: </span>
              <span className={f.valueClass ?? 'text-gray-700 font-medium'}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {actions && (
        <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100 flex-wrap" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Badge status kecil seragam untuk header kartu mobile. */
export function MobileCardBadge({ children, className, style, title }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; title?: string;
}) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded whitespace-nowrap ${className ?? ''}`} style={style} title={title}>
      {children}
    </span>
  );
}
