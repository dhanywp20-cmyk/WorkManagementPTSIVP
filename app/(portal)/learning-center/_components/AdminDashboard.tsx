'use client';

import { useState, useEffect } from 'react';
import { matchesTeamFilter, type TeamFilter } from './team-filter';
import { useKelompokCabang } from '@/lib/kelompok/inti';
import { supabase, User, SearchInput } from './shared';
import { StatCardGrid } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { ModalNilaiPengguna } from './ModalNilaiPengguna';
import { RingkasanKuis } from './RingkasanKuis';
import { AktivitasTerbaru } from './AktivitasTerbaru';
import { StatistikDivisi } from './StatistikDivisi';
import { StatistikSesiKuis } from './StatistikSesiKuis';
import { PapanPerforma } from './PapanPerforma';

export function AdminDashboard({ user }: { user: User }) {
  const kunciCabang = useKelompokCabang().map(k => k.nama).join('|');
  const [stats, setStats] = useState({ materials: 0, activeTeam: 0, sessions: 0, attempts: 0 });
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [overviewStats, setOverviewStats] = useState({
    totalUsers: 0, participants: 0, mulai: 0,
    passCount: 0, failCount: 0,
    scoreGood: 0, scoreMid: 0, scoreLow: 0,
    submitted: 0, abandoned: 0,
  });

  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [searchPerformer, setSearchPerformer] = useState('');

  const [divisionStats, setDivisionStats] = useState<any[]>([]);
  const [nationalAvg, setNationalAvg] = useState<number | null>(null);
  const [performerDivisionFilter, setPerformerDivisionFilter] = useState<string>('');

  const [selectedUser, setSelectedUser] = useState<{ uid: string; name: string } | null>(null);
  const [userAttempts, setUserAttempts] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamFilter>('PTS');
  const [allTopUsers, setAllTopUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [mat, ses, att, totalUsersRes, ringkasRes] = await Promise.all([
        supabase.from('lc_materials').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_attempts').select('user_id, is_submitted'),
      ]);
      const ringkas = (ringkasRes.data ?? []) as { user_id: string; is_submitted: boolean | null }[];
      const uniqueTeam = new Set(ringkas.filter(a => a.is_submitted).map(a => a.user_id)).size;
      setStats({ materials: mat.count ?? 0, activeTeam: uniqueTeam, sessions: ses.count ?? 0, attempts: att.count ?? 0 });

      const [recentRes, allAttRes, usersRes] = await Promise.all([
        supabase.from('lc_quiz_attempts')
          .select('*, lc_quiz_sessions(session_name, passing_grade)')
          .eq('is_submitted', true).order('submitted_at', { ascending: false }).limit(50),
        supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
        supabase.from('users').select('id, full_name, jabatan, sales_division, team_type, role'),
      ]);
      const userMap: Record<string, any> = {};
      (usersRes.data ?? []).forEach((u: any) => { userMap[u.id] = u; });
      setRecentAttempts((recentRes.data ?? []).map((a: any) => ({ ...a, users: userMap[a.user_id] ?? null })));

      const allAtt = (allAttRes.data ?? [])
        .filter((a: any) => a.grading_status !== 'pending_review')
        .map((a: any) => ({ ...a, users: userMap[a.user_id] ?? null }));

      const participants = new Set(allAtt.map((a: any) => a.user_id)).size;
      const passCount    = allAtt.filter((a: any) => a.passed).length;
      const scoreGood    = allAtt.filter((a: any) => (a.score ?? 0) >= 80).length;
      const scoreMid     = allAtt.filter((a: any) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length;
      const scoreLow     = allAtt.filter((a: any) => (a.score ?? 0) < 60).length;
      const mulai = new Set(ringkas.map(a => a.user_id)).size;
      setOverviewStats({
        totalUsers: totalUsersRes.count ?? 0,
        participants,
        mulai,
        passCount,
        failCount: allAtt.length - passCount,
        scoreGood, scoreMid, scoreLow,
        submitted: allAtt.length,
        abandoned: ringkas.filter(a => a.is_submitted === false).length,
      });

      const byUser: Record<string, {
        name: string; scores: number[]; times: number[]; passed: number; tabSw: number;
        minScore: number; maxScore: number; fastCount: number;
        role: string | null; teamType: string | null; salesDivision: string | null;
      }> = {};
      allAtt.forEach((a: any) => {
        if (!byUser[a.user_id]) byUser[a.user_id] = {
          name: a.users?.full_name ?? '-', scores: [], times: [], passed: 0, tabSw: 0,
          minScore: Infinity, maxScore: -Infinity, fastCount: 0,
          role: a.users?.role ?? null,
          teamType: a.users?.team_type ?? null,
          salesDivision: a.users?.sales_division ?? null,
        };
        const sc = a.score ?? 0;
        byUser[a.user_id].scores.push(sc);
        if (typeof a.time_taken_sec === 'number') byUser[a.user_id].times.push(a.time_taken_sec);
        if (a.passed) byUser[a.user_id].passed++;
        byUser[a.user_id].tabSw += a.tab_switches ?? 0;
        if (sc < byUser[a.user_id].minScore) byUser[a.user_id].minScore = sc;
        if (sc > byUser[a.user_id].maxScore) byUser[a.user_id].maxScore = sc;
        const tq = a.total_questions ?? 0;
        const ts = a.time_taken_sec ?? Infinity;
        if (tq >= 5 && ts < tq * 5) byUser[a.user_id].fastCount++;
      });
      const allUsers = Object.entries(byUser).map(([uid, v]) => ({
        uid, name: v.name,
        role: v.role, teamType: v.teamType, salesDivision: v.salesDivision,
        avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
        avgTime: v.times.length ? v.times.reduce((s: number, n: number) => s + n, 0) / v.times.length : Infinity,
        total: v.scores.length, passed: v.passed, tabSw: v.tabSw,
        consistency: v.scores.length >= 2 ? v.maxScore - v.minScore : null,
        fastCount: v.fastCount,
      })).sort((a, b) => b.avg - a.avg || a.avgTime - b.avgTime || a.uid.localeCompare(b.uid));
      setAllTopUsers(allUsers);
      setTopUsers(allUsers.filter(u => matchesTeamFilter(u, 'PTS')).slice(0, 20));

      const byDiv: Record<string, {
        scores: number[]; passed: number;
        source: 'division' | 'jabatan' | 'other';
        jabatanSet: Set<string>;
      }> = {};
      allAtt.forEach((a: any) => {
        const sd = a.users?.sales_division?.trim();
        const jb = a.users?.jabatan?.trim();
        const dk = sd || jb || 'Lainnya';
        const src: 'division' | 'jabatan' | 'other' = sd ? 'division' : jb ? 'jabatan' : 'other';
        if (!byDiv[dk]) byDiv[dk] = { scores: [], passed: 0, source: src, jabatanSet: new Set() };
        byDiv[dk].scores.push(a.score ?? 0);
        if (a.passed) byDiv[dk].passed++;
        if (jb) byDiv[dk].jabatanSet.add(jb);
      });
      setDivisionStats(Object.entries(byDiv).map(([name, v]) => ({
        name,
        source: v.source,
        jabatan: Array.from(v.jabatanSet).join(', '),
        total: v.scores.length,
        avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
        passRate: Math.round((v.passed / v.scores.length) * 100),
        passed: v.passed,
      })).sort((a, b) => b.avg - a.avg));

      const allScoresNational = allAtt.map((a: any) => a.score ?? 0);
      setNationalAvg(allScoresNational.length ? allScoresNational.reduce((s: number, n: number) => s + n, 0) / allScoresNational.length : null);

      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        const perSesi = new Map<string, any[]>();
        for (const a of (allAttRes.data ?? []) as any[]) {
          const daftar = perSesi.get(a.quiz_session_id);
          if (daftar) daftar.push(a); else perSesi.set(a.quiz_session_id, [a]);
        }
        const sStats = ss.map((s) => {
          const sa = perSesi.get(s.id);
          if (!sa?.length) return null;
          const avg = sa.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / sa.length;
          const passed = sa.filter((a: any) => a.passed).length;
          const durations = sa
            .filter((a: any) => a.started_at && a.submitted_at)
            .map((a: any) => (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000);
          const avgMin = durations.length ? durations.reduce((s: number, d: number) => s + d, 0) / durations.length : null;
          return {
            id: s.id, name: s.session_name, total: sa.length, avg, passed,
            failed: sa.length - passed, avgMin,
            scoreGood: sa.filter((a: any) => (a.score ?? 0) >= 80).length,
            scoreMid: sa.filter((a: any) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length,
            scoreLow: sa.filter((a: any) => (a.score ?? 0) < 60).length,
          };
        });
        setSessionStats(sStats.filter(Boolean));
      }
      setLoadingAnalytics(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (allTopUsers.length > 0) {
      setTopUsers(allTopUsers.filter(u => matchesTeamFilter(u, activeTeam)).slice(0, 20));
    if (activeTeam !== 'Sales' && performerDivisionFilter) setPerformerDivisionFilter('');
      setSearchPerformer('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam, allTopUsers, kunciCabang]);

  useEffect(() => {
    if (!selectedUser) return;
    setLoadingUser(true); setUserAttempts([]);
    supabase
      .from('lc_quiz_attempts')
      .select('id, score, passed, total_correct, total_questions, time_taken_sec, submitted_at, tab_switches, lc_quiz_sessions(session_name, materi_name, passing_grade)')
      .eq('user_id', selectedUser.uid).eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => { setUserAttempts(data ?? []); setLoadingUser(false); });
  }, [selectedUser]);

  const filteredRecent = recentAttempts.filter(a =>
    !search ||
    (a.users?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.lc_quiz_sessions?.session_name ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredPerformers = topUsers
    .filter(u => activeTeam !== 'Sales' || !performerDivisionFilter || u.salesDivision === performerDivisionFilter)
    .filter(u => !searchPerformer || u.name.toLowerCase().includes(searchPerformer.toLowerCase()));

  const cards = [
    { label: 'Total Materi', value: stats.materials, sub: 'Materi tersedia', accent: '#1d4ed8' },
    { label: 'Active Team', value: stats.activeTeam, sub: 'Anggota aktif', accent: '#6d28d9' },
    { label: 'Sesi Aktif', value: stats.sessions, sub: 'Sesi quiz berjalan', accent: '#047857' },
    { label: 'Total Attempt', value: stats.attempts, sub: 'Pengerjaan tercatat', accent: '#b45309' },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight"><IkonTeks nama="📊" />Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Selamat datang, {user.full_name}</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari aktivitas..." />
      </div>

      <div className="p-4 sm:p-8 space-y-10">

        <StatCardGrid cols={4} items={cards} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          <RingkasanKuis o={overviewStats} />

          <PapanPerforma
            nationalAvg={nationalAvg} activeTeam={activeTeam} performerDivisionFilter={performerDivisionFilter} divisionStats={divisionStats} setActiveTeam={setActiveTeam} setPerformerDivisionFilter={setPerformerDivisionFilter}
            searchPerformer={searchPerformer} setSearchPerformer={setSearchPerformer} filteredPerformers={filteredPerformers} setSelectedUser={setSelectedUser} loadingAnalytics={loadingAnalytics}
          />
        </div>

        <StatistikSesiKuis sessionStats={sessionStats} />

        <StatistikDivisi divisionStats={divisionStats} nationalAvg={nationalAvg} />

        <AktivitasTerbaru filteredRecent={filteredRecent} search={search} />

      </div>

      <ModalNilaiPengguna selectedUser={selectedUser} setSelectedUser={setSelectedUser} userAttempts={userAttempts} loadingUser={loadingUser} />
    </div>
  );
}
