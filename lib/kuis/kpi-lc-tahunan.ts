
import { supabase } from '../supabase';

export interface SesiLC {
  id: string;
  open_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  close_at: string | null;
  closed_at: string | null;
  is_active: boolean | null;
  target_user_ids: string[] | null;
  allow_retake?: boolean | null;
}

export interface AttemptLC {
  user_id: string;
  quiz_session_id: string;
  passed: boolean | null;
  grading_status: string | null;
}

export interface RekapLCTahunan {
  wajib: number;
  lulus: number;
  gagal: number;
  tidakIkut: number;
  faktor: number;
}

export const REKAP_LC_KOSONG: RekapLCTahunan = { wajib: 0, lulus: 0, gagal: 0, tidakIkut: 0, faktor: 1 };

export function tahunSesi(s: SesiLC): number {
  return new Date(s.open_at ?? s.scheduled_at ?? s.created_at).getFullYear();
}

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
    const selesai = sesiSelesai(s, adaAttemptDiSesi.has(s.id), sekarang);
    if (mine.length) {
      if (mine.some(a => a.passed === true)) { wajib++; lulus++; continue; }
      if (mine.some(a => a.grading_status === 'pending_review')) continue;
      if (s.allow_retake && !selesai) continue;
      wajib++; gagal++;
      continue;
    }
    const ditargetkan = (s.target_user_ids ?? []).includes(userId);
    if (ditargetkan && selesai) { wajib++; tidakIkut++; }
  }
  return { wajib, lulus, gagal, tidakIkut, faktor: wajib ? lulus / wajib : 1 };
}

const cache = new Map<string, { waktu: number; janji: Promise<Record<string, RekapLCTahunan>> }>();
const UMUR_CACHE_MS = 60_000;

export function ambilRekapLCTahunan(userIds: string[], tahun: number): Promise<Record<string, RekapLCTahunan>> {
  const kunci = `${tahun}:${[...userIds].sort().join(',')}`;
  const ada = cache.get(kunci);
  if (ada && Date.now() - ada.waktu < UMUR_CACHE_MS) return ada.janji;
  const janji = muatRekap(userIds, tahun);
  cache.set(kunci, { waktu: Date.now(), janji });
  return janji;
}

async function muatRekap(userIds: string[], tahun: number): Promise<Record<string, RekapLCTahunan>> {
  const hasil: Record<string, RekapLCTahunan> = {};
  userIds.forEach(id => { hasil[id] = REKAP_LC_KOSONG; });
  if (!userIds.length) return hasil;
  const { data, error } = await supabase.rpc('rekap_lc_tahunan', { p_user_ids: userIds, p_tahun: tahun });
  if (error) { console.warn('[kpi-lc-tahunan] rekap:', error.message); return hasil; }
  for (const r of (data ?? []) as { user_id: string; wajib: number; lulus: number; gagal: number; tidak_ikut: number }[]) {
    hasil[r.user_id] = {
      wajib: r.wajib, lulus: r.lulus, gagal: r.gagal, tidakIkut: r.tidak_ikut,
      faktor: r.wajib ? r.lulus / r.wajib : 1,
    };
  }
  return hasil;
}
