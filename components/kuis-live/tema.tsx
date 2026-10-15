'use client';

/**
 * Tema Kuis Live (ala Kahoot) - dipakai layar peserta (/kelas/<token>) dan layar host admin.
 * Warna & bentuk tiap pilihan sama persis di kedua layar, supaya peserta yang melihat proyektor
 * cukup mencocokkan warna/bentuk.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pilihan } from '@/lib/kelas-eksternal';
import { teksDiAtas } from '@/lib/kuis-live';

export const UNGU = '#46178f';
export const UNGU_TUA = '#25076b';
export const HIJAU = '#26890c';
export const MERAH = '#e21b3c';

export const PILIHAN_KUIS: readonly Pilihan[] = ['A', 'B', 'C', 'D'];
export const WARNA_PILIHAN: Record<Pilihan, string> = { A: '#e21b3c', B: '#1368ce', C: '#d89e00', D: '#26890c' };
const NAMA_BENTUK: Record<Pilihan, string> = { A: 'segitiga', B: 'belah ketupat', C: 'lingkaran', D: 'kotak' };

/** Bentuk putih tiap pilihan: A segitiga, B belah ketupat, C lingkaran, D kotak. */
export function BentukPilihan({ p, ukuran = 28, className = '' }: { p: Pilihan; ukuran?: number; className?: string }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 32 32" className={`flex-shrink-0 ${className}`} role="img" aria-label={NAMA_BENTUK[p]}>
      {p === 'A' && <path d="M16 3 L30 28 H2 Z" fill="white" />}
      {p === 'B' && <path d="M16 2 L30 16 L16 30 L2 16 Z" fill="white" />}
      {p === 'C' && <circle cx="16" cy="16" r="13" fill="white" />}
      {p === 'D' && <rect x="4" y="4" width="24" height="24" rx="2" fill="white" />}
    </svg>
  );
}

/** Tampilan per kuis yang diatur admin: warna tema, logo event, gambar latar. */
export interface TemaKuis { warna: string | null; logo: string | null; latar: string | null }

/**
 * Latar layar kuis: gambar latar event (digelapkan supaya tulisan tetap terbaca) atau warna tema
 * bermotif samar seperti Kahoot. `warna` menimpa tema - dipakai layar Benar (hijau) / Salah (merah).
 */
export function LatarKuis({ children, tema, warna, className = '' }: { children: React.ReactNode; tema?: TemaKuis | null; warna?: string; className?: string }) {
  const dasar = warna ?? tema?.warna ?? UNGU;
  const gambar = !warna && tema?.latar;
  const terang = !gambar && teksDiAtas(dasar) !== '#ffffff';
  return (
    <div className={`relative min-h-dvh overflow-hidden text-white ${className}`}
      style={{
        backgroundColor: dasar, transition: 'background-color .3s',
        ...(gambar ? { backgroundImage: `linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.68)), url("${gambar}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}>
      {!gambar && <>
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/[0.07]" />
        <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -right-16 w-48 h-48 rotate-12 rounded-3xl bg-white/[0.05]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-10 w-96 h-96 rotate-45 bg-black/[0.08]" />
      </>}
      {/* Warna tema yang sangat terang: digelapkan sedikit supaya tulisan putih tetap terbaca. */}
      {terang && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/35" />}
      <div className="relative">{children}</div>
    </div>
  );
}

/** Logo event di atas kotak putih (logo gelap tetap terlihat di latar gelap). */
export function LogoEvent({ url, tinggi = 40, className = '' }: { url: string | null | undefined; tinggi?: number; className?: string }) {
  if (!url) return null;
  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Logo event" style={{ height: tinggi, width: 'auto', maxWidth: tinggi * 4 }} className="object-contain" />
    </span>
  );
}

/** Kemajuan kuis: "Soal x dari N" + bilah bersegmen. */
export function BilahSoal({ indeks, total, selesai = false, terang = true }: { indeks: number; total: number; selesai?: boolean; terang?: boolean }) {
  const jadi = selesai ? total : indeks;
  return (
    <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={jadi} aria-label={`Soal ${Math.min(indeks + 1, total)} dari ${total}`}>
      <div className={`flex items-center justify-between text-[12px] font-extrabold mb-1 ${terang ? 'text-white/90' : 'text-slate-700'}`}>
        <span>Soal {Math.min(indeks + 1, total)} dari {total}</span>
        <span className="tabular-nums">{Math.round((jadi / Math.max(1, total)) * 100)}%</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < jadi ? 'bg-white' : i === indeks && !selesai ? 'bg-white/60 animate-pulse' : 'bg-white/20'}`} />
        ))}
      </div>
    </div>
  );
}

/** Sisa waktu soal: bilah yang menyusut + angka detik. */
export function BilahWaktu({ sisaMs, durasiMs }: { sisaMs: number; durasiMs: number }) {
  const r = Math.max(0, Math.min(1, sisaMs / Math.max(1, durasiMs)));
  const detik = Math.ceil(sisaMs / 1000);
  return (
    <div className="flex items-center gap-2" aria-label={`Sisa waktu ${detik} detik`}>
      <div className="flex-1 h-3 rounded-full bg-black/25 overflow-hidden">
        <div className={`h-full rounded-full ${r < 0.25 ? 'bg-[#ff3355]' : 'bg-white'}`} style={{ width: `${r * 100}%`, transition: 'width .2s linear' }} />
      </div>
      <span className={`w-10 text-right text-[18px] font-black tabular-nums ${r < 0.25 ? 'text-[#ffd0d8]' : ''}`}>{detik}</span>
    </div>
  );
}

/** Hitung mundur besar sebelum pilihan muncul. */
export function HitungMundur({ sisaMs }: { sisaMs: number }) {
  const n = Math.max(1, Math.ceil(sisaMs / 1000));
  return (
    <div className="mx-auto w-28 h-28 rounded-full bg-white/15 border-[6px] border-white flex items-center justify-center" aria-live="polite">
      <span key={n} className="text-[54px] font-black tabular-nums animate-[kuis-denyut_1s_ease-out]">{n}</span>
      <style>{'@keyframes kuis-denyut{0%{transform:scale(1.6);opacity:.2}40%{transform:scale(1);opacity:1}}'}</style>
    </div>
  );
}

/**
 * Jam server di peramban: selisih jam perangkat vs server diukur dari tiap respons (sampel dengan
 * jeda jaringan terpendek yang dipakai), supaya hitung mundur di semua perangkat serentak walau
 * jam HP peserta melenceng.
 */
export function useJamServer() {
  const selisih = useRef(0);
  const rttTerbaik = useRef(Number.POSITIVE_INFINITY);
  const catat = useCallback((sekarangServer: number, t0: number, t1: number) => {
    const rtt = t1 - t0;
    //  Sampel lama bisa basi (jam HP disetel ulang) - beri sedikit kelonggaran supaya tetap diperbarui.
    if (rtt <= rttTerbaik.current + 150) {
      rttTerbaik.current = Math.min(rttTerbaik.current, rtt);
      selisih.current = sekarangServer - (t0 + rtt / 2);
    }
  }, []);
  const sekarang = useCallback(() => Date.now() + selisih.current, []);
  return { catat, sekarang };
}

/** Render ulang berkala selama `aktif` (untuk bilah waktu & hitung mundur). */
export function useDetak(aktif: boolean, ms = 200) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!aktif) return;
    const t = window.setInterval(() => setN(n => n + 1), ms);
    return () => window.clearInterval(t);
  }, [aktif, ms]);
}

const angka = (n: number) => n.toLocaleString('id-ID');
export { angka as formatPoin };

/** Podium juara 1-3 (urutan tampil 2-1-3 seperti Kahoot). */
export function Podium({ juara, besar = false }: { juara: { nama: string; poin: number; peringkat: number }[]; besar?: boolean }) {
  const tinggi = besar ? { 1: 'h-40', 2: 'h-28', 3: 'h-20' } : { 1: 'h-32', 2: 'h-24', 3: 'h-16' };
  const susunan = [juara[1], juara[0], juara[2]];
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-3">
      {susunan.map((j, i) => {
        const posisi = (i === 1 ? 1 : i === 0 ? 2 : 3) as 1 | 2 | 3;
        if (!j) return <div key={i} className={besar ? 'w-48' : 'w-24'} />;
        return (
          <div key={i} className={`flex flex-col items-center ${besar ? 'w-48' : 'w-24'}`}>
            <p className={`font-black text-center leading-tight break-words w-full ${besar ? 'text-[24px] mb-2' : 'text-[14px] mb-1'}`}>{j.nama}</p>
            <p className={`font-bold text-white/85 tabular-nums ${besar ? 'text-[18px] mb-2' : 'text-[12px] mb-1'}`}>{angka(j.poin)}</p>
            <div className={`w-full ${tinggi[posisi]} rounded-t-lg flex items-start justify-center pt-1 shadow-lg ${posisi === 1 ? 'bg-[#f5b800]' : posisi === 2 ? 'bg-slate-300' : 'bg-[#cd7f32]'}`}>
              <span className={`font-black text-white drop-shadow ${besar ? 'text-[48px]' : 'text-[30px]'}`}>{posisi}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
