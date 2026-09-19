'use client';
import React from 'react';
import { useMerek } from '@/lib/merek';
import { ChipVersi } from './ChipVersi';

/**
 * Bilah kaki platform - tipis, dari ujung ke ujung, menempel di dasar layar.
 *
 * SATU komponen untuk kedua tampilan dashboard (dengan sidebar maupun tanpa).
 * Sebelumnya hanya tampilan tanpa-sidebar yang punya kaki, sementara tampilan
 * bersidebar - yang justru dipakai sepanjang hari sesudah login - tidak punya
 * sama sekali. Menyalin markup-nya akan mengulang persoalan yang sama begitu
 * isinya berubah di salah satu tempat saja.
 *
 * Isinya dibagi seperti kaki halaman pada umumnya: identitas di kiri, bantuan
 * dan keterangan build di kanan. Semuanya dari merek, jadi tidak ada satu pun
 * nama company yang terpaku di kode.
 */
export function FooterPlatform() {
  const merek = useMerek();
  //  Tahun dihitung, bukan ditulis. "© 2026" yang dipaku akan keliru diam-diam
  //  begitu tahun berganti, dan tidak akan ada yang melaporkannya.
  const tahun = new Date().getFullYear();
  const kontak = (merek.kontakDukungan ?? '').trim();
  const surel = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontak);

  return (
    <footer className="flex-shrink-0 border-t border-slate-200/70"
      style={{ background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="px-3 md:px-6 py-1.5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500 font-medium truncate min-w-0">
          © {tahun} {merek.namaPerusahaan}
          {merek.kredit && <span className="text-slate-400"> · {merek.kredit}</span>}
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/*  Disembunyikan di layar sempit, BUKAN dikecilkan: di ponsel kaki
              ini memakan tinggi yang dibutuhkan modul, dan alamat bantuan
              bukan hal yang dicari orang sambil bekerja. */}
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
