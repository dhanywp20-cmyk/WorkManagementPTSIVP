'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ingat } from '@/lib/cache-singkat';
import { ASSIGNABLE_PTS_TEAMS } from '@/lib/teams';

export interface Anggota {
  id: string; name: string; reported: boolean; active: number;
  jabatan: string; atasanId: string | null;
}

export interface DaftarTim {
  loading: boolean;
  rows: Anggota[];
  atasan: Record<string, { nama: string; jabatan: string }>;
}

const UMUR_HARIAN = 60_000;

/** Daily Report tim hari ini. Beranda memanggilnya dari dua kartu; `ingat` membuatnya satu kali permintaan. */
export function useDaftarTim(): DaftarTim {
  const [hasil, setHasil] = useState<DaftarTim>({ loading: true, rows: [], atasan: {} });

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      try {
        const [{ data: team }, { data: reports }, { data: rems }] = await Promise.all([
          ingat('users:team-pts-atasan', () => supabase.from('users').select('id, username, full_name, team_type, jabatan, atasan_id').eq('role', 'team')
            .in('team_type', [...ASSIGNABLE_PTS_TEAMS])),
          ingat(`daily-tim:lapor:${today}`, () => supabase.from('daily_reports').select('user_id').eq('report_date', today), UMUR_HARIAN),
          ingat(`daily-tim:jadwal:${today}`, () => supabase.from('reminders').select('assigned_to').eq('due_date', today).neq('status', 'done').neq('status', 'cancelled'), UMUR_HARIAN),
        ]);
        const reported = new Set((reports ?? []).map((r: any) => r.user_id));
        const activeBy: Record<string, number> = {};
        (rems ?? []).forEach((r: any) => { if (r.assigned_to) activeBy[r.assigned_to] = (activeBy[r.assigned_to] ?? 0) + 1; });
        const rows: Anggota[] = (team ?? []).map((m: any) => ({
          id: m.id as string, name: m.full_name as string, reported: reported.has(m.id),
          active: activeBy[m.username] ?? 0,
          jabatan: (m.jabatan as string) ?? '', atasanId: (m.atasan_id as string) ?? null,
        })).sort((a: Anggota, b: Anggota) => Number(a.reported) - Number(b.reported) || b.active - a.active);

        const idAtasan = Array.from(new Set(rows.map(m => m.atasanId).filter(Boolean))) as string[];
        const atasan: DaftarTim['atasan'] = {};
        if (idAtasan.length) {
          const { data: bos } = await ingat(`users:atasan:${[...idAtasan].sort().join(',')}`, () => supabase.from('users').select('id, full_name, jabatan').in('id', idAtasan));
          (bos ?? []).forEach((b: any) => { atasan[b.id] = { nama: b.full_name ?? '—', jabatan: b.jabatan ?? '' }; });
        }
        if (alive) setHasil({ loading: false, rows, atasan });
      } catch {
        if (alive) setHasil(h => ({ ...h, loading: false }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return hasil;
}
