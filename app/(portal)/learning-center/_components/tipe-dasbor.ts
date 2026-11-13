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
