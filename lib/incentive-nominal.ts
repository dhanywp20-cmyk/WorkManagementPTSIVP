/**
 * lib/incentive-nominal.ts - aturan siapa boleh MELIHAT nominal total proyek insentif.
 *
 * Nominalnya tidak lagi di kolom `reminders.incentive_value` (tabel itu terbaca
 * semua orang yang boleh melihat jadwalnya - sales, PIC, pembuat, lingkup
 * divisi). Ia disimpan di tabel terkunci `incentive_nominal` yang HANYA bisa
 * dibaca server (service role); layar mengambilnya lewat /api/incentive/nominal.
 *
 * Berkas ini MURNI (tanpa Supabase/fetch) supaya aturan yang sama dipakai route
 * server dan layar, dan bisa diuji tanpa basis data.
 */
import { bisaInputNominal, type PemilikAkses } from './incentive-akses';

/** Kunci app_settings tempat aturan disimpan. */
export const KUNCI_ATURAN_NOMINAL = 'incentive.nominal';

/**
 * petugas - hanya pemegang akses input/penuh yang melihat nominal total.
 *           Yang lain hanya melihat bagiannya sendiri yang sudah tercatat.
 * terlibat - petugas + orang yang terlibat di proyek itu (PIC/handler, atau
 *            sudah punya baris bagian) melihat nominal proyeknya sendiri.
 */
export type LihatNominal = 'petugas' | 'terlibat';

export interface AturanNominal { lihat: LihatNominal }

export const ATURAN_NOMINAL_BAWAAN: AturanNominal = { lihat: 'petugas' };

export function rapikanAturanNominal(v: unknown): AturanNominal {
  const lihat = (v as { lihat?: unknown } | null)?.lihat;
  return { lihat: lihat === 'terlibat' ? 'terlibat' : 'petugas' };
}

/**
 * Lingkup brand petugas. Kosong = tanpa batas. Proyek "BOTH" terlihat oleh
 * kedua brand; proyek tanpa brand tetap terlihat supaya yang lolos tanpa brand
 * kelihatan dan bisa dibetulkan, bukan lenyap dari semua daftar.
 */
export function bolehLihatBrand(lingkup: string | null | undefined, brandProyek: string | null | undefined): boolean {
  if (!lingkup) return true;
  if (!brandProyek) return true;
  return brandProyek === lingkup || brandProyek === 'BOTH';
}

export interface BarisNominal {
  id: string;
  brand?: string | null;
  pic_id?: string | null;
  assigned_to?: string | null;
  assign_name?: string | null;
}

export interface PenggunaNominal {
  id: string;
  username?: string | null;
  full_name?: string | null;
}

/** Terlibat = PIC/handler proyek, atau sudah punya baris bagian di proyek itu. */
export function terlibatDiProyek(baris: BarisNominal, p: PenggunaNominal, punyaBagian: boolean): boolean {
  if (punyaBagian) return true;
  const uname = (p.username || '').toLowerCase();
  const nama = (p.full_name || '').toLowerCase();
  if (p.id && baris.pic_id && baris.pic_id === p.id) return true;
  if (uname && (baris.assigned_to || '').toLowerCase() === uname) return true;
  if (nama && (baris.assign_name || '').toLowerCase() === nama) return true;
  return false;
}

/** Putusan satu baris: apakah nominal proyek ini boleh dikirim ke pemanggil. */
export function nominalTerbuka(args: {
  hak: PemilikAkses;
  lingkupBrand: string | null | undefined;
  aturan: AturanNominal;
  baris: BarisNominal;
  pengguna: PenggunaNominal;
  punyaBagian: boolean;
}): boolean {
  const { hak, lingkupBrand, aturan, baris, pengguna, punyaBagian } = args;
  if (bisaInputNominal(hak)) return bolehLihatBrand(lingkupBrand, baris.brand);
  if (aturan.lihat === 'terlibat') return terlibatDiProyek(baris, pengguna, punyaBagian);
  return false;
}

/**
 * Tempelkan nominal ke baris proyek. SELALU menimpa `incentive_value`: bila
 * proyek tidak ada di peta (tidak berhak / belum diisi) nilainya 0, jadi sisa
 * nilai lama di kolom reminders tidak pernah bocor ke layar.
 */
export function tempelkanNominal<T extends { id: string; incentive_value?: number | null }>(
  baris: T[], peta: Record<string, number>,
): T[] {
  return baris.map(b => ({ ...b, incentive_value: Number(peta[b.id]) || 0 }));
}
