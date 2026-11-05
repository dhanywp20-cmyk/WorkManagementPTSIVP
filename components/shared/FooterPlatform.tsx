'use client';
import React from 'react';
import { useMerek } from '@/lib/merek';
import { ChipVersi } from './ChipVersi';

export function FooterPlatform() {
  const merek = useMerek();
  const tahun = new Date().getFullYear();
  const kontak = (merek.kontakDukungan ?? '').trim();
  const surel = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontak);

  return (
    <footer className="flex-shrink-0 border-t border-slate-200/70"
      style={{ background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="px-3 md:px-6 py-1.5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500 font-medium truncate min-w-0">
          © {tahun} {merek.namaPerusahaan}
          {merek.kredit && <span className="text-slate-500"> · {merek.kredit}</span>}
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          {kontak && (
            <span className="text-[11px] text-slate-500 hidden md:inline whitespace-nowrap">
              Butuh bantuan?{' '}
              {surel
                ? <a href={`mailto:${kontak}`} className="font-semibold hover:underline" style={{ color: merek.warnaUtama }}>{kontak}</a>
                : <span className="font-semibold text-slate-700">{kontak}</span>}
            </span>
          )}
          <ChipVersi className="hidden sm:inline-flex" />
        </div>
      </div>
    </footer>
  );
}
