/**
 * lib/kpi-lc-tahunan.ts - faktor pengali KPI dari kelulusan Learning Center
 * dalam SATU TAHUN kalender.
 *
 * Keputusan pemilik platform (2026-09-24):
 *   KPI akhir = KPI dasar × (sesi LC lulus ÷ sesi LC wajib di tahun itu).
 *   Sesi yang ditargetkan ke seseorang tetapi tidak ia kerjakan sampai sesi
 *   selesai dihitung TIDAK LULUS - supaya menghindari quiz tidak jadi cara
 *   mengamankan KPI.
 *
 * Satuan hitungnya SESI, bukan attempt: retake yang akhirnya lulus = sesi
 * lulus. Status lulus memakai `passed` dari attempt (passing grade milik
 * sesinya), bukan ambang lcMinScore global - sesi bisa punya passing grade
 * berbeda-beda (60/65/70/85).
 *
 * Basisnya tahun, bukan periode yang sedang dipilih di layar: "Bulan Ini"
 * yang kebetulan tanpa sesi LC tidak boleh menghapus kegagalan di bulan lain
 * pada tahun yang sama.
 *
 * `rekapLCTahunan` murni (tanpa Supabase) - lihat uji/kpi-lc-tahunan.ts.
 */

import { supabase } from './supabase';

export interface SesiLC {
  id: string;
  open_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  close_at: string | null;
  closed_at: string | null;
  is_active: boolean | null;
  target_user_ids: string[] | null;
}

export interface AttemptLC {
  user_id: string;
  quiz_session_id: string;
  passed: boolean | null;
  grading_status: string | null;
}

export interface RekapLCTahunan {
  /** Sesi yang masuk hitungan (dikerjakan, atau ditargetkan & sudah selesai). */
  wajib: number;
  lulus: number;
  /** Dikerjakan tapi tidak lulus. */
  gagal: number;
  /** Ditargetkan, sesi sudah selesai, tidak dikerjakan sama sekali. */
  tidakIkut: number;
  /** Pengali KPI akhir, 0..1. Tanpa sesi wajib = 1 (tidak ada potongan). */
  faktor: number;
}

export const REKAP_LC_KOSONG: RekapLCTahunan = { wajib: 0, lulus: 0, gagal: 0, tidakIkut: 0, faktor: 1 };

export function tahunSesi(s: SesiLC): number {
  return new Date(s.open_at ?? s.scheduled_at ?? s.created_at).getFullYear();
}

/**
 * Sesi dianggap SUDAH SELESAI bila ditutup manual, waktu tutupnya lewat,
 * atau sudah nonaktif padahal pernah dikerjakan orang. Sesi nonaktif yang
 * belum pernah dikerjakan siapa pun adalah draf - tidak menghukum siapa pun.
 */
export function sesiSelesai(s: SesiLC, adaAttempt: boolean, sekarang: Date): boolean {
  if (s.closed_at) return true;
  if (s.close_at && new Date(s.close_at) < sekarang) return true;
  return s.is_active === false && adaAttempt;
}

export function rekapLCTahunan(
  userId: string, tahun: number, sesi: SesiLC[], attempts: AttemptLC[], sekarang = new Date(),
): RekapLCTahunan {
  const sesiTahunIni = sesi.filter(s => tahunSesi(s) === tahun);
  const adaAttemptDiSesi = new Set(attempts.map(a => a.quiz_session_id));
  const milikku = attempts.filter(a => a.user_id === userId);

  let wajib = 0, lulus = 0, gagal = 0, tidakIkut = 0;
  for (const s of sesiTahunIni) {
    const mine = milikku.filter(a => a.quiz_session_id === s.id);
    if (mine.length) {
      if (mine.some(a => a.passed === true)) { wajib++; lulus++; continue; }
      // Essay yang belum dinilai: hasilnya belum ada - jangan dihukum dulu.
      if (mine.some(a => a.grading_status === 'pending_review')) continue;
      wajib++; gagal++;
      continue;
    }
    const ditargetkan = (s.target_user_ids ?? []).includes(userId);
    if (ditargetkan && sesiSelesai(s, adaAttemptDiSesi.has(s.id), sekarang)) { wajib++; tidakIkut++; }
  }
  return { wajib, lulus, gagal, tidakIkut, faktor: wajib ? lulus / wajib : 1 };
}

/** Ambil data setahun lalu rekap per user. Gagal memuat = tanpa potongan (bukan potongan penuh). */
export async function ambilRekapLCTahunan(userIds: string[], tahun: number): Promise<Record<string, RekapLCTahunan>> {
  const hasil: Record<string, RekapLCTahunan> = {};
  userIds.forEach(id => { hasil[id] = REKAP_LC_KOSONG; });
  if (!userIds.length) return hasil;

  const { data: sesiData, error: e1 } = await supabase.from('lc_quiz_sessions')
    .select('id, open_at, scheduled_at, created_at, close_at, closed_at, is_active, target_user_ids');
  if (e1) { console.warn('[kpi-lc-tahunan] sesi:', e1.message); return hasil; }
  const sesi = ((sesiData ?? []) as SesiLC[]).filter(s => tahunSesi(s) === tahun);
  if (!sesi.length) return hasil;

  // Semua attempt di sesi tahun ini (bukan hanya milik anggota): dibutuhkan
  // untuk tahu apakah sebuah sesi nonaktif pernah benar-benar dijalankan.
  const { data: attData, error: e2 } = await supabase.from('lc_quiz_attempts')
    .select('user_id, quiz_session_id, passed, grading_status')
    .in('quiz_session_id', sesi.map(s => s.id)).eq('is_submitted', true);
  if (e2) { console.warn('[kpi-lc-tahunan] attempt:', e2.message); return hasil; }
  const attempts = (attData ?? []) as AttemptLC[];

  const sekarang = new Date();
  for (const id of userIds) hasil[id] = rekapLCTahunan(id, tahun, sesi, attempts, sekarang);
  return hasil;
}
