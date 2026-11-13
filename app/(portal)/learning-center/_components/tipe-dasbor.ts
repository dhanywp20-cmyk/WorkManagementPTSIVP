import type { Tables } from '@/types/database';

export type PenggunaLC = Pick<Tables<'users'>, 'id' | 'full_name' | 'jabatan' | 'sales_division' | 'team_type' | 'role'>;

export type PercobaanTerbaru = Tables<'lc_quiz_attempts'> & {
  lc_quiz_sessions: Pick<Tables<'lc_quiz_sessions'>, 'session_name' | 'passing_grade'> | null;
  users: PenggunaLC | null;
};

export interface PercobaanPengguna {
  id: string;
  score: number | null;
  passed: boolean | null;
  total_correct: number | null;
  total_questions: number | null;
  time_taken_sec: number | null;
  submitted_at: string | null;
  tab_switches: number | null;
  lc_quiz_sessions: Pick<Tables<'lc_quiz_sessions'>, 'session_name' | 'materi_name' | 'passing_grade'> | null;
}

export interface StatSesi {
  id: string; name: string; total: number; avg: number; passed: number; failed: number;
  avgMin: number | null; scoreGood: number; scoreMid: number; scoreLow: number;
}

export interface StatDivisi {
  name: string; source: 'division' | 'jabatan' | 'other'; jabatan: string;
  total: number; avg: number; passRate: number; passed: number;
}

export interface Performer {
  uid: string; name: string; role: string | null; teamType: string | null; salesDivision: string | null;
  avg: number; avgTime: number; total: number; passed: number; tabSw: number;
  consistency: number | null; fastCount: number;
}

export interface PerformerLC {
  uid: string; name: string; division: string | null; teamType: string | null; role: string | null; salesDivision: string | null;
  avg: number; avgTime: number; total: number; passed: number; flags: number;
}

export interface DivisiLC {
  div: string; avg: number; total: number; passed: number; users: number;
  scoreGood: number; scoreMid: number; scoreLow: number;
}

export function hitungStatSesi(sesi: { id: string; session_name: string }[], percobaan: Tables<'lc_quiz_attempts'>[]): StatSesi[] {
  const perSesi = new Map<string, Tables<'lc_quiz_attempts'>[]>();
  for (const a of percobaan) {
    if (!a.quiz_session_id) continue;
    const daftar = perSesi.get(a.quiz_session_id);
    if (daftar) daftar.push(a); else perSesi.set(a.quiz_session_id, [a]);
  }
  const hasil: StatSesi[] = [];
  for (const s of sesi) {
    const sa = perSesi.get(s.id);
    if (!sa?.length) continue;
    const avg = sa.reduce((sum, a) => sum + (a.score ?? 0), 0) / sa.length;
    const passed = sa.filter((a) => a.passed).length;
    const durasi = sa
      .filter((a) => a.started_at && a.submitted_at)
      .map((a) => (new Date(a.submitted_at ?? '').getTime() - new Date(a.started_at ?? '').getTime()) / 60000);
    hasil.push({
      id: s.id, name: s.session_name, total: sa.length, avg, passed, failed: sa.length - passed,
      avgMin: durasi.length ? durasi.reduce((t, d) => t + d, 0) / durasi.length : null,
      scoreGood: sa.filter((a) => (a.score ?? 0) >= 80).length,
      scoreMid: sa.filter((a) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length,
      scoreLow: sa.filter((a) => (a.score ?? 0) < 60).length,
    });
  }
  return hasil;
}
