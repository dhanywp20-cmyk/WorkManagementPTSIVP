'use client';

import { useState, useEffect } from 'react';
import { matchesTeamFilter, type TeamFilter } from './team-filter';
import { useKelompokCabang } from '@/lib/kelompok/inti';
import { supabase } from './shared';
import { hitungStatSesi, type PenggunaLC, type PercobaanPengguna, type StatSesi, type PerformerLC, type DivisiLC } from './tipe-dasbor';

export function useAnalyticsLC() {
  const kunciCabang = useKelompokCabang().map(k => k.nama).join('|');
  const [topUsers, setTopUsers] = useState<PerformerLC[]>([]);
  const [allTopUsers, setAllTopUsers] = useState<PerformerLC[]>([]);
  const [sessionStats, setSessionStats] = useState<StatSesi[]>([]);
  const [divisionStats, setDivisionStats] = useState<DivisiLC[]>([]);
  const [nationalAvg, setNationalAvg] = useState<number | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<TeamFilter>('PTS');

  const [selectedUser, setSelectedUser] = useState<{ uid: string; name: string } | null>(null);
  const [userAttempts, setUserAttempts] = useState<PercobaanPengguna[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: mentah }, { data: pengguna }] = await Promise.all([
        supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
        supabase.from('users').select('id, full_name, sales_division, team_type, role'),
      ]);
      const petaUser: Record<string, Pick<PenggunaLC, 'id' | 'full_name' | 'sales_division' | 'team_type' | 'role'>> = {};
      (pengguna ?? []).forEach((u) => { petaUser[u.id] = u; });
      const a = mentah ? mentah.map((x) => ({ ...x, users: (x.user_id ? petaUser[x.user_id] : undefined) ?? null })) : null;

      if (a) {
        const graded = a.filter((att) => att.grading_status !== 'pending_review');
        const byUser: Record<string, { name: string; division: string | null; teamType: string | null; role: string | null; salesDivision: string | null; scores: number[]; times: number[]; passed: number; flags: number }> = {};
        graded.forEach((att) => {
          if (!att.user_id) return;
          if (!byUser[att.user_id]) byUser[att.user_id] = {
            name: att.users?.full_name ?? '-',
            division: att.users?.sales_division ?? null,
            teamType: att.users?.team_type ?? null,
            role: att.users?.role ?? null,
            salesDivision: att.users?.sales_division ?? null,
            scores: [], times: [], passed: 0, flags: 0,
          };
          byUser[att.user_id].scores.push(att.score ?? 0);
          if (typeof att.time_taken_sec === 'number') byUser[att.user_id].times.push(att.time_taken_sec);
          if (att.passed) byUser[att.user_id].passed++;
          byUser[att.user_id].flags += att.tab_switches ?? 0;
        });
        const allUsers = Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name, division: v.division, teamType: v.teamType,
          role: v.role, salesDivision: v.salesDivision,
          avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
          avgTime: v.times.length ? v.times.reduce((s: number, n: number) => s + n, 0) / v.times.length : Infinity,
          total: v.scores.length, passed: v.passed, flags: v.flags,
        })).sort((a, b) => b.avg - a.avg || a.avgTime - b.avgTime || a.uid.localeCompare(b.uid));
        setAllTopUsers(allUsers);
        setTopUsers(allUsers.filter(u => matchesTeamFilter(u, 'PTS')).slice(0, 20));

        const byDiv: Record<string, { scores: number[]; passed: number; userIds: Set<string> }> = {};
        graded.forEach((att) => {
          if (!att.user_id) return;
          const div: string = att.users?.sales_division ?? '(Tidak ada divisi)';
          if (!byDiv[div]) byDiv[div] = { scores: [], passed: 0, userIds: new Set() };
          byDiv[div].scores.push(att.score ?? 0);
          if (att.passed) byDiv[div].passed++;
          byDiv[div].userIds.add(att.user_id);
        });
        setDivisionStats(Object.entries(byDiv).map(([div, v]) => ({
          div,
          avg: v.scores.reduce((s, n) => s + n, 0) / v.scores.length,
          total: v.scores.length,
          passed: v.passed,
          users: v.userIds.size,
          scoreGood: v.scores.filter(s => s >= 80).length,
          scoreMid:  v.scores.filter(s => s >= 60 && s < 80).length,
          scoreLow:  v.scores.filter(s => s < 60).length,
        })).sort((a, b) => b.avg - a.avg));

        const allScores = graded.map((att) => att.score ?? 0);
        setNationalAvg(allScores.length ? allScores.reduce((s: number, n: number) => s + n, 0) / allScores.length : null);
      }

      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        setSessionStats(hitungStatSesi(ss, mentah ?? []));
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (allTopUsers.length > 0) {
      setTopUsers(allTopUsers.filter(u => matchesTeamFilter(u, activeTeam)).slice(0, 20));
      setSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam, allTopUsers, kunciCabang]);

  useEffect(() => {
    if (!selectedUser) return;
    setLoadingUser(true);
    setUserAttempts([]);
    supabase
      .from('lc_quiz_attempts')
      .select('id, score, passed, total_correct, total_questions, time_taken_sec, submitted_at, tab_switches, lc_quiz_sessions(session_name, materi_name, passing_grade)')
      .eq('user_id', selectedUser.uid)
      .eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => { setUserAttempts((data ?? []) as PercobaanPengguna[]); setLoadingUser(false); });
  }, [selectedUser]);

  const filteredUsers = topUsers
    .filter(u => !divisionFilter || u.salesDivision === divisionFilter)
    .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()));
  return {
    activeTeam, setActiveTeam, search, setSearch, sessionStats, nationalAvg, divisionStats, divisionFilter,
    setDivisionFilter, filteredUsers, setSelectedUser, loading, selectedUser, loadingUser, userAttempts,
  };
}
