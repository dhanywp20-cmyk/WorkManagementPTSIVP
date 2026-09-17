'use client';
import { useEffect, useMemo, useState } from 'react';

/**
 * Paginasi daftar - SATU mekanisme untuk semua modul.
 *
 * Sebelumnya cuma Ticketing yang punya paginasi (30 baris/halaman, ditulis
 * langsung di halamannya). Modul lain merender SELURUH hasil saring dalam
 * satu tabel: begitu datanya menumpuk, halamannya memanjang ratusan baris,
 * menggulung jadi satu-satunya cara menemukan apa pun, dan setiap penyaringan
 * ulang memaksa browser mengecat seluruh daftar dari awal.
 *
 * Dipakai lewat `usePaginasi(daftarTersaring)` + `<Paginasi {...} />`.
 */

/**
 * Jumlah baris per halaman di SELURUH platform.
 *
 * Satu angka di satu tempat - kalau nanti mau diubah, cukup di sini dan
 * semua modul ikut. Jangan tulis angkanya langsung di halaman mana pun;
 * itu persis bagaimana Ticketing sempat berjalan sendiri di angka 30
 * sementara modul lain tidak berpaginasi sama sekali.
 */
export const BARIS_PER_HALAMAN = 15;

export interface HasilPaginasi<T> {
  /** Halaman aktif, SUDAH dijamin berada dalam rentang yang sah. */
  halaman: number;
  setHalaman: (n: number) => void;
  totalHalaman: number;
  /** Potongan data untuk halaman aktif - ini yang dirender tabel. */
  potongan: T[];
  /** Indeks baris pertama halaman ini di dalam daftar penuh (basis 0). */
  mulai: number;
  /** Jumlah baris di SELURUH daftar (bukan cuma halaman ini). */
  total: number;
  perHalaman: number;
}

export function usePaginasi<T>(daftar: T[], perHalaman = BARIS_PER_HALAMAN): HasilPaginasi<T> {
  const [halaman, setHalaman] = useState(1);
  const total = daftar.length;
  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));

  /*
    Kembali ke halaman 1 begitu daftarnya menyusut melewati halaman aktif.

    Tanpa ini, seseorang yang sedang di halaman 5 lalu mengetik kata kunci
    yang menyisakan 8 baris akan melihat TABEL KOSONG - datanya ada, tapi
    halaman 5 dari 1 halaman memang tidak berisi apa-apa. Kegagalan seperti
    ini tidak pernah dilaporkan sebagai bug paginasi; yang dilaporkan
    "datanya hilang setelah difilter".
  */
  useEffect(() => {
    if (halaman > totalHalaman) setHalaman(1);
  }, [halaman, totalHalaman]);

  //  Dipakai untuk memotong SEKARANG juga, tidak menunggu efek di atas
  //  berjalan - kalau tidak, ada satu kali render dengan potongan kosong.
  const halamanAman = Math.min(halaman, totalHalaman);
  const mulai = (halamanAman - 1) * perHalaman;
  const potongan = useMemo(
    () => daftar.slice(mulai, mulai + perHalaman),
    [daftar, mulai, perHalaman],
  );

  return { halaman: halamanAman, setHalaman, totalHalaman, potongan, mulai, total, perHalaman };
}

/**
 * Bilah navigasi halaman. Gayanya mengikuti Ticketing (satu-satunya modul
 * yang sudah punya paginasi sebelum ini) supaya tidak ada dua bentuk pager
 * berbeda di satu produk.
 *
 * `satuan` cuma untuk label jumlah, mis. "tiket", "jadwal", "project".
 */
export function Paginasi({
  halaman, setHalaman, totalHalaman, mulai, total, perHalaman,
  satuan = 'baris', warna = '#dc2626',
}: {
  halaman: number;
  setHalaman: (n: number) => void;
  totalHalaman: number;
  mulai: number;
  total: number;
  perHalaman: number;
  satuan?: string;
  /** Warna tombol halaman aktif - disamakan dengan aksen modulnya. */
  warna?: string;
}) {
  //  Bilahnya TETAP dirender walau cuma satu halaman: label "menampilkan
  //  1-8 dari 8" itu sendiri informasi yang berguna, dan bilah yang muncul-
  //  hilang membuat tinggi tabel melompat setiap kali filter diubah.
  const tombolHalaman = useMemo(() => {
    const maks = Math.min(5, totalHalaman);
    return Array.from({ length: maks }, (_, i) => {
      if (totalHalaman <= 5) return i + 1;
      if (halaman <= 3) return i + 1;
      if (halaman >= totalHalaman - 2) return totalHalaman - 4 + i;
      return halaman - 2 + i;
    });
  }, [halaman, totalHalaman]);

  const akhir = Math.min(mulai + perHalaman, total);

  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-200 flex-wrap gap-2"
      style={{ background: 'rgba(255,255,255,0.97)' }}>
      <span className="text-xs text-gray-400">
        {total > 0 ? `${mulai + 1}–${akhir}` : '0'} dari {total} {satuan}
      </span>

      {totalHalaman > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Halaman pertama" title="Halaman pertama"
            onClick={() => setHalaman(1)} disabled={halaman === 1}
            className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">«</button>
          <button type="button" onClick={() => setHalaman(Math.max(1, halaman - 1))} disabled={halaman === 1}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">‹ Prev</button>

          <div className="flex items-center gap-1">
            {tombolHalaman.map(n => (
              <button key={n} type="button" onClick={() => setHalaman(n)}
                aria-label={`Halaman ${n}`} aria-current={halaman === n ? 'page' : undefined}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  halaman === n ? 'text-white border-0' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                style={halaman === n ? { background: warna } : {}}>
                {n}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setHalaman(Math.min(totalHalaman, halaman + 1))} disabled={halaman === totalHalaman}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">Next ›</button>
          <button type="button" aria-label="Halaman terakhir" title="Halaman terakhir"
            onClick={() => setHalaman(totalHalaman)} disabled={halaman === totalHalaman}
            className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">»</button>
        </div>
      )}

      <span className="text-xs text-gray-400">Hal. {halaman}/{totalHalaman}</span>
    </div>
  );
}
