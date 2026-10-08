'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleX, X } from 'lucide-react';
import { NAMA_EVENT_GALAT_TULIS, type GalatTulis } from '@/lib/galat-tulis';

/**
 * Pemberitahuan "perubahan tidak tersimpan" untuk SEMUA modul (lihat lib/galat-tulis.ts).
 * Dipasang sekali di app/layout.tsx. Di bawah tengah supaya tidak bertumpuk dengan Toast halaman
 * yang tampil di kanan atas. Pesan sama dalam 6 detik tidak diulang (simpan beruntun / retry), dan
 * halaman yang sudah menampilkan Toast gagalnya sendiri tidak diberi pesan kedua.
 */
export function PenjagaGalatTulis() {
  const [galat, setGalat] = useState<GalatTulis | null>(null);
  const terakhir = useRef<{ pesan: string; waktu: number } | null>(null);
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dengar = (e: Event) => {
      const g = (e as CustomEvent<GalatTulis>).detail;
      if (!g) return;
      const sekarang = Date.now();
      if (terakhir.current && terakhir.current.pesan === g.pesan && sekarang - terakhir.current.waktu < 6000) return;
      terakhir.current = { pesan: g.pesan, waktu: sekarang };
      //  Tunggu sebentar: halaman yang memeriksa `error`-nya sendiri sudah menampilkan Toast-nya
      //  (role="status", fixed) - pesan kedua dari sini hanya menggandakan, jadi mengalah.
      setTimeout(() => {
        const toastHalaman = Array.from(document.querySelectorAll<HTMLElement>('[role="status"].fixed, [role="alert"].fixed'))
          .some(el => !el.hasAttribute('data-penjaga-galat') && el.innerText.trim() !== '');
        if (toastHalaman) return;
        setGalat(g);
        if (pewaktu.current) clearTimeout(pewaktu.current);
        pewaktu.current = setTimeout(() => setGalat(null), 8000);
      }, 700);
    };
    window.addEventListener(NAMA_EVENT_GALAT_TULIS, dengar);
    return () => { window.removeEventListener(NAMA_EVENT_GALAT_TULIS, dengar); if (pewaktu.current) clearTimeout(pewaktu.current); };
  }, []);

  if (!galat) return null;
  return (
    <div role="alert" data-penjaga-galat=""
      className="fixed bottom-4 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[28rem] z-[3100] px-4 py-3 rounded-xl text-sm font-semibold flex items-start gap-2.5 animate-slide-up"
      style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', boxShadow: '0 8px 24px rgba(15,23,42,0.16)' }}>
      <CircleX size={18} aria-hidden="true" className="flex-shrink-0 mt-px" />
      <span className="leading-snug flex-1">{galat.pesan}</span>
      <button type="button" onClick={() => setGalat(null)} aria-label="Tutup pemberitahuan"
        className="flex-shrink-0 -m-1 p-1 rounded-md hover:bg-red-100">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
