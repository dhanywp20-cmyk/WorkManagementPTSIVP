import { supabase } from '../supabase';

export interface RekapLCPeriode {
  attempts: number;
  rataRata: number;
  lulus: number;
  nilai: number[];
}

export const LC_PERIODE_KOSONG: RekapLCPeriode = { attempts: 0, rataRata: 0, lulus: 0, nilai: [] };

type BarisRPC = { user_id: string; attempts: number; rata_rata: number; lulus: number; nilai: (number | string)[] | null };

function rekapDariAttempt(baris: { user_id: string; score: number | null; passed: boolean | null; grading_status: string | null }[]) {
  const hasil: Record<string, RekapLCPeriode> = {};
  for (const a of baris) {
    if (a.grading_status === 'pending_review') continue;
    const r = hasil[a.user_id] ?? (hasil[a.user_id] = { attempts: 0, rataRata: 0, lulus: 0, nilai: [] });
    r.attempts++;
    if (a.passed === true) r.lulus++;
    if (a.score != null) r.nilai.push(Number(a.score));
  }
  for (const r of Object.values(hasil)) {
    r.nilai.sort((x, y) => x - y);
    r.rataRata = r.nilai.length ? Math.round(r.nilai.reduce((s, v) => s + v, 0) / r.nilai.length) : 0;
  }
  return hasil;
}

/**
 * Rekap attempt LC per anggota untuk rentang tanggal KPI (UTC, sama seperti filter tabel lain).
 * Dihitung di server lewat RPC kpi_lc_periode supaya Supervisor melihat angka yang sama dengan
 * Manager/admin: RLS lc_quiz_attempts hanya membuka baris milik sendiri untuk role team.
 */
export async function ambilLCPeriode(userIds: string[], start: string, end: string): Promise<Record<string, RekapLCPeriode>> {
  if (!userIds.length) return {};
  const mulai = `${start}T00:00:00Z`;
  const akhir = `${end}T23:59:59Z`;
  const { data, error } = await supabase.rpc('kpi_lc_periode', { p_user_ids: userIds, p_mulai: mulai, p_akhir: akhir });
  if (!error) {
    const hasil: Record<string, RekapLCPeriode> = {};
    for (const r of (data ?? []) as BarisRPC[]) {
      hasil[r.user_id] = { attempts: r.attempts, rataRata: r.rata_rata, lulus: r.lulus, nilai: (r.nilai ?? []).map(Number) };
    }
    return hasil;
  }
  // RPC belum terpasang: pakai bacaan langsung (terbatas RLS) seperti sebelumnya.
  console.warn('[kpi-lc-periode] rpc:', error.message);
  const { data: baris } = await supabase.from('lc_quiz_attempts')
    .select('user_id,score,passed,grading_status')
    .in('user_id', userIds).eq('is_submitted', true)
    .gte('started_at', mulai).lte('started_at', akhir);
  return rekapDariAttempt((baris ?? []) as { user_id: string; score: number | null; passed: boolean | null; grading_status: string | null }[]);
}
