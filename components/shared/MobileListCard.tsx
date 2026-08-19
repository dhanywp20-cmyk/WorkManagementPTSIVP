'use client';

import React from 'react';

/**
 * MobileListCard - kartu daftar untuk tampilan MOBILE, pola acuan dari
 * Ticket Troubleshooting: header (judul + badge status di kanan), meta
 * (lokasi/tanggal), grid 2-kolom label:value, lalu baris ikon aksi.
 *
 * Dipakai agar SEMUA platform punya gaya kartu mobile yang sama. Bungkus dalam
 * `<div className="md:hidden divide-y divide-gray-100">` dan sembunyikan tabel
 * desktop dengan `hidden md:block`.
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
      className={`px-4 py-3.5 border-l-4 ${highlight ? 'bg-red-50/60' : ''} ${onClick ? 'active:bg-gray-50 cursor-pointer' : ''}`}
      style={{ borderLeftColor: accent ?? 'transparent' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {titlePrefix}
            <p className="font-bold text-sm text-gray-800 leading-tight break-words">{title}</p>
          </div>
          {meta && <div className="text-[10px] text-gray-400 mt-0.5 space-y-0.5">{meta}</div>}
        </div>
        {badges && <div className="flex flex-col items-end gap-1 shrink-0">{badges}</div>}
      </div>

      {visibleFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 text-xs">
          {visibleFields.map((f, i) => (
            <div key={i} className={`truncate ${f.span2 ? 'col-span-2' : ''}`}>
              <span className="text-gray-400">{f.label}: </span>
              <span className={f.valueClass ?? 'text-gray-700 font-medium'}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {actions && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Badge status kecil seragam untuk header kartu mobile. */
export function MobileCardBadge({ children, className, style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded whitespace-nowrap ${className ?? ''}`} style={style}>
      {children}
    </span>
  );
}
