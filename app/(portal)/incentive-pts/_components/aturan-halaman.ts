/**
 * aturan-halaman.ts - Aturan & tipe tingkat-halaman Incentive PTS, dipindah dari page.tsx supaya bisa
 * dipakai komponen pecahannya (page.tsx Next.js tidak boleh mengekspor nama selain default).
 */
import type { IncentiveProjectRow } from './calc';
import { persenPicBerlaku, type SkemaInsentif } from './calc';
import { bisaKonfigPenuh, bisaInputNominal } from '@/lib/incentive-akses';

export interface CurrentUser { id?: string; username?: string; full_name?: string; role?: string; team_type?: string; incentive_akses?: string | null; allow_incentive_input?: boolean; incentive_brand_scope?: string | null; [k: string]: unknown; }

/**
 * Proyek ini boleh dilihat oleh petugas dengan lingkup brand tertentu?
 *
 * Lingkup kosong = tanpa batas (admin, dan petugas yang belum ditetapkan
 * lingkupnya). Proyek "BOTH" terlihat oleh KEDUA petugas - ia memang milik
 * bersama, dan menyembunyikannya dari salah satu justru membuat proyeknya
 * tidak terinput sama sekali.
 *
 * Proyek tanpa brand juga ditampilkan, bukan disembunyikan: kalau ada yang
 * lolos tanpa brand, itu harus KELIHATAN supaya bisa dibetulkan - bukan
 * lenyap dari kedua daftar tanpa ada yang tahu.
 */
export function bolehLihatBrand(lingkup: string | null | undefined, brandProyek: string | null | undefined): boolean {
  if (!lingkup) return true;
  if (!brandProyek) return true;
  return brandProyek === lingkup || brandProyek === 'BOTH';
}

/*
  SIAPA BOLEH APA — DATA, BUKAN KODE.

  Dua fungsi ini dulu berbunyi `role === 'admin' || role === 'superadmin'`,
  dan seluruh tab konfigurasi digantung padanya. Akibatnya Manager PTS -
  pimpinan modul ini - hanya melihat tab "Projects", dan membukanya berarti
  mengubah kode lalu deploy ulang. Sekarang jawabannya dibaca dari kolom
  `users.incentive_akses` yang disetel dari tab "Pengaturan Akses" (lihat
  lib/incentive-akses.ts). Basis data memakai aturan yang sama lewat fungsi
  akses_insentif(), jadi layar tidak bisa memberi izin yang ditolak RLS -
  keadaan yang dulu membuat Process Batch gagal diam-diam.
*/
export function bisaKonfig(u: CurrentUser | null) { return bisaKonfigPenuh(u); }
export function bisaInput(u: CurrentUser | null) { return bisaInputNominal(u); }

/**
 * Ringkasan cepat "berapa bagian Handler" untuk kolom daftar.
 *
 * Angkanya diambil dari skema yang berlaku, bukan dipatok di sini. Versi lama
 * menulis 60% dan faktor 0.85 langsung di rumus ini - nilai yang sudah tidak
 * cocok lagi dengan tabel pembagian, sehingga kolom daftar dan layar rincian
 * bisa menampilkan angka yang berbeda untuk proyek yang sama.
 */
export function calcHandlerSplit(sk: SkemaInsentif | null, p: IncentiveProjectRow): { pct: number; amt: number } | null {
  const pool = p.incentive_value || 0;
  if (!pool || !p.mode_penyelesaian || !sk) return null;
  /*
    Angkanya diambil dari petaPorsiBerlaku - fungsi yang sama dengan yang
    dipakai mesin pembayaran.

    Sebelumnya baris ini menghitung sendiri: porsi PIC dari `sk.porsi` dikali
    sisa pool sesudah Installer. Perhitungan itu tidak pernah melihat tabel
    Porsi Remote, jadi pada proyek Remote yang tabelnya diatur sendiri, kartu
    menulis 51% (60 x 0,85) padahal yang dibayar 40%. Layar dan pembayaran
    tidak boleh punya dua rumus untuk satu angka.

    Ringkasan memakai keadaan "ada Troubleshooting" - keadaan yang paling
    sering terjadi sepanjang 3 tahun masa pencairan.
  */
  const pct = persenPicBerlaku(
    sk, p.mode_penyelesaian === 'remote', true, p.pic_type === 'manager_pic',
  );
  return { pct, amt: Math.round((pool * pct) / 100) };
}

export type TabKey = 'projects' | 'tranches' | 'late' | 'skema' | 'settings';
