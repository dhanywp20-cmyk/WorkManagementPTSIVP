'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ingat } from '@/lib/cache-singkat';
import { ASSIGNABLE_PTS_TEAMS } from '@/lib/teams';

export type StatusLapor = 'manual' | 'otomatis' | 'kosong';

export interface Anggota {
  id: string; username: string; name: string; reported: boolean; active: number;
  jabatan: string; atasanId: string | null;
  status: StatusLapor; tiket: string[]; jadwal: string[]; jadwalMinggu: number;
}

export interface DaftarTim {
  loading: boolean;
  rows: Anggota[];
  atasan: Record<string, { nama: string; jabatan: string }>;
  minggu: { mulai: string; akhir: string };
}

const UMUR_HARIAN = 60_000;
const URUTAN: Record<StatusLapor, number> = { kosong: 0, otomatis: 1, manual: 2 };

const tanggalWIB = (geser = 0) => new Date(Date.now() + 7 * 3600_000 + geser * 86_400_000).toISOString().slice(0, 10);

export function rentangMinggu(): { mulai: string; akhir: string } {
  const keSenin = (new Date(Date.now() + 7 * 3600_000).getUTCDay() + 6) % 7;
  return { mulai: tanggalWIB(-keSenin), akhir: tanggalWIB(6 - keSenin) };
}

const masuk = (peta: Map<string, Set<string>>, kunci: string | null | undefined, isi: string) => {
  if (!kunci) return;
  if (!peta.has(kunci)) peta.set(kunci, new Set());
  peta.get(kunci)!.add(isi);
};

type Log = { ticket_id: string | null; handler_username: string | null };

export function useDaftarTim(): DaftarTim {
  const [hasil, setHasil] = useState<DaftarTim>({ loading: true, rows: [], atasan: {}, minggu: rentangMinggu() });

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = tanggalWIB();
      const minggu = rentangMinggu();
      const awal = new Date(`${today}T00:00:00+07:00`).toISOString();
      const ujung = new Date(`${today}T23:59:59+07:00`).toISOString();
      try {
        const [{ data: team }, { data: reports }, { data: rems }, { data: logs }, { data: isu }] = await Promise.all([
          ingat('users:team-pts-aktif', () => supabase.from('users').select('id, username, full_name, team_type, jabatan, atasan_id, tanggal_nonaktif').eq('role', 'team')
            .in('team_type', [...ASSIGNABLE_PTS_TEAMS])),
          ingat(`daily-tim:lapor:${today}`, () => supabase.from('daily_reports').select('user_id').eq('report_date', today), UMUR_HARIAN),
          ingat(`daily-tim:jadwal:${minggu.mulai}`, () => supabase.from('reminders').select('assigned_to, due_date, status, project_name')
            .gte('due_date', minggu.mulai).lte('due_date', minggu.akhir).neq('status', 'cancelled'), UMUR_HARIAN),
          ingat(`daily-tim:tiket:${today}`, () => supabase.from('activity_logs').select('ticket_id, handler_username').gte('created_at', awal).lte('created_at', ujung), UMUR_HARIAN),
          ingat(`daily-tim:isu:${today}`, () => supabase.from('ticket_issue_logs').select('ticket_id, handler_username').gte('created_at', awal).lte('created_at', ujung), UMUR_HARIAN),
        ]);

        const semuaLog = [...((logs ?? []) as Log[]), ...((isu ?? []) as Log[])].filter(l => l.ticket_id);
        const idTiket = Array.from(new Set(semuaLog.map(l => l.ticket_id as string)));
        const namaTiket: Record<string, string> = {};
        if (idTiket.length) {
          const { data: tk } = await supabase.from('tickets').select('id, project_name').in('id', idTiket);
          (tk ?? []).forEach((t) => { namaTiket[t.id] = t.project_name ?? 'Tiket'; });
        }
        const tiketBy = new Map<string, Set<string>>();
        semuaLog.forEach(l => masuk(tiketBy, l.handler_username, namaTiket[l.ticket_id as string] ?? 'Tiket'));

        const jadwalBy: Record<string, string[]> = {};
        const activeBy: Record<string, number> = {};
        const mingguBy: Record<string, number> = {};
        (rems ?? []).forEach((r) => {
          if (!r.assigned_to) return;
          mingguBy[r.assigned_to] = (mingguBy[r.assigned_to] ?? 0) + 1;
          if (r.due_date !== today) return;
          (jadwalBy[r.assigned_to] ??= []).push(r.project_name || 'Jadwal');
          if (r.status !== 'done') activeBy[r.assigned_to] = (activeBy[r.assigned_to] ?? 0) + 1;
        });

        const reported = new Set((reports ?? []).map((r) => r.user_id));
        const rows: Anggota[] = (team ?? [])
          .filter((m) => !m.tanggal_nonaktif || m.tanggal_nonaktif > today)
          .map((m): Anggota => {
            const username = (m.username as string) ?? '';
            const tiket = Array.from(tiketBy.get(username) ?? []);
            const jadwal = jadwalBy[username] ?? [];
            const lapor = reported.has(m.id);
            const status: StatusLapor = lapor ? 'manual' : tiket.length + jadwal.length > 0 ? 'otomatis' : 'kosong';
            return {
              id: m.id as string, username, name: m.full_name as string, reported: lapor,
              active: activeBy[username] ?? 0, jabatan: (m.jabatan as string) ?? '', atasanId: (m.atasan_id as string) ?? null,
              status, tiket, jadwal, jadwalMinggu: mingguBy[username] ?? 0,
            };
          })
          .sort((a: Anggota, b: Anggota) => URUTAN[a.status] - URUTAN[b.status] || b.active - a.active);

        const idAtasan = Array.from(new Set(rows.map(m => m.atasanId).filter(Boolean))) as string[];
        const atasan: DaftarTim['atasan'] = {};
        if (idAtasan.length) {
          const { data: bos } = await ingat(`users:atasan:${[...idAtasan].sort().join(',')}`, () => supabase.from('users').select('id, full_name, jabatan').in('id', idAtasan));
          (bos ?? []).forEach((b) => { atasan[b.id] = { nama: b.full_name ?? '—', jabatan: b.jabatan ?? '' }; });
        }
        if (alive) setHasil({ loading: false, rows, atasan, minggu });
      } catch {
        if (alive) setHasil(h => ({ ...h, loading: false }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return hasil;
}
