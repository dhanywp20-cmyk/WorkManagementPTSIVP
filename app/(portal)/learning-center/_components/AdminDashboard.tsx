'use client';

import React, { useState, useEffect } from 'react';
import { TeamSwitch, matchesTeamFilter, TEAM_FILTER_CONFIG, type TeamFilter } from './team-filter';
import { useKelompokCabang } from '@/lib/kelompok/inti';
import { supabase, User, fmtDate, ScoreBadge, SearchInput } from './shared';
import { StatCardGrid, DonutChart } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ModalNilaiPengguna } from './ModalNilaiPengguna';
import { RingkasanKuis, SectionHeader } from './RingkasanKuis';

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
        const sStats = ss.map((s: any) => {
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

          <div className="min-w-0">
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-600 whitespace-nowrap"
                    title="Diurutkan dari skor rata-rata tertinggi. Jika skor sama, rata-rata waktu pengerjaan tercepat menang.">
                    <IkonTeks nama="🏆" />Top Performers
                  </span>
                  {nationalAvg !== null && (
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      <IkonTeks nama="🌏" />Nasional: <span className="font-bold text-slate-800">{nationalAvg.toFixed(1)}</span>
                      {activeTeam === 'Sales' && performerDivisionFilter && (() => {
                        const d = divisionStats.find(d => d.name === performerDivisionFilter);
                        if (!d) return null;
                        const gap = d.avg - nationalAvg;
                        return (
                          <span className={`ml-1.5 font-bold ${gap >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            · {performerDivisionFilter} {d.avg.toFixed(1)} ({gap >= 0 ? '▲' : '▼'}{Math.abs(gap).toFixed(1)})
                          </span>
                        );
                      })()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <TeamSwitch active={activeTeam} onChange={setActiveTeam} />
                  <select aria-label="Filter divisi" value={performerDivisionFilter} onChange={e => setPerformerDivisionFilter(e.target.value)}
                    disabled={activeTeam !== 'Sales'}
                    aria-hidden={activeTeam !== 'Sales'}
                    className={`text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400 bg-white font-semibold text-slate-600 ${activeTeam === 'Sales' && divisionStats.length > 0 ? '' : 'invisible pointer-events-none'}`}>
                    <option value="">Semua Divisi</option>
                    {divisionStats.filter(d => d.source === 'division').map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                  <SearchInput value={searchPerformer} onChange={setSearchPerformer} placeholder="Cari nama..." />
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[440px]">
              <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                <thead className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Nama</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPerformers.map((u, i) => (
                    <tr key={u.uid}
                      className="stagger-item hover:bg-indigo-50/60 cursor-pointer transition-colors group"
                      onClick={() => setSelectedUser({ uid: u.uid, name: u.name })}>
                      <td className="px-4 py-3 text-center text-sm font-black text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors text-sm">{u.name}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-indigo-400 font-semibold"><Ikon nama="👁" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                          {u.consistency !== null && u.consistency > 40 && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><IkonTeks nama="⚡" />Inkonsisten</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs font-semibold">{u.total}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <DonutChart
                            segments={[
                              { value: u.avg, color: u.avg >= 80 ? '#10b981' : u.avg >= 70 ? '#f59e0b' : '#f43f5e' },
                              { value: 100 - u.avg, color: '#f1f5f9' },
                            ]}
                            size={34} strokeWidth={5} label={u.avg.toFixed(0)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.passed > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                          {u.passed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {u.tabSw > 0 && (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {u.tabSw}×</span>
                          )}
                          {u.fastCount > 0 && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full"><Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /> {u.fastCount}×</span>
                          )}
                          {u.tabSw === 0 && u.fastCount === 0 && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPerformers.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500 text-sm">
                      {loadingAnalytics ? 'Memuat data...' : searchPerformer ? 'Tidak ada hasil' : `Belum ada data untuk ${TEAM_FILTER_CONFIG[activeTeam].label}`}
                    </td></tr>
                  )}
                </tbody>
              </table>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><IkonTeks nama="⚠" />N×</span>
                  Pindah tab
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-0.5 font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full"><IkonTeks nama="🚨" />N×</span>
                  Submit &lt;5det/soal
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><IkonTeks nama="⚡" />Inkonsisten</span>
                  Nilai selisih &gt;40pt
                </span>
              </div>
            </div>
          </div>
        </div>

        {sessionStats.length > 0 && (() => {
          const totalPeserta = sessionStats.reduce((n: number, s: any) => n + s.total, 0);
          const totalPassed  = sessionStats.reduce((n: number, s: any) => n + s.passed, 0);
          const totalFailed  = sessionStats.reduce((n: number, s: any) => n + s.failed, 0);
          const scoreGood    = sessionStats.reduce((n: number, s: any) => n + s.scoreGood, 0);
          const scoreMid     = sessionStats.reduce((n: number, s: any) => n + s.scoreMid, 0);
          const scoreLow     = sessionStats.reduce((n: number, s: any) => n + s.scoreLow, 0);
          const avgScore     = totalPeserta > 0
            ? sessionStats.reduce((n: number, s: any) => n + s.avg * s.total, 0) / totalPeserta : 0;
          const sesiDenganWaktu = sessionStats.filter((s: any) => s.avgMin !== null);
          const avgMin = sesiDenganWaktu.length
            ? sesiDenganWaktu.reduce((n: number, s: any) => n + s.avgMin, 0) / sesiDenganWaktu.length : null;
          const sesiUrut = [...sessionStats].sort((a: any, b: any) => a.avg - b.avg);

          return (
            <section>
              <SectionHeader><IkonTeks nama="📈" />Statistik Per Sesi Quiz</SectionHeader>
              <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex flex-wrap items-start gap-8">
                  <div className="flex flex-col items-center gap-1.5">
                    <DonutChart size={92} strokeWidth={13}
                      segments={[{ value: totalPassed, color: '#10b981' }, { value: totalFailed, color: '#f43f5e' }]}
                      label={totalPeserta > 0 ? `${Math.round(totalPassed / totalPeserta * 100)}%` : '-'}
                    />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lulus vs Gagal</span>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{totalPassed} lulus</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{totalFailed} gagal</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <DonutChart size={92} strokeWidth={13}
                      segments={[
                        { value: scoreGood, color: '#3b82f6' },
                        { value: scoreMid, color: '#f59e0b' },
                        { value: scoreLow, color: '#ef4444' },
                      ]}
                      label={avgScore.toFixed(0)}
                    />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sebaran Nilai</span>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />≥80: {scoreGood}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />60–79: {scoreMid}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />&lt;60: {scoreLow}</span>
                    </div>
                  </div>
                  {avgMin !== null && (
                    <div className="flex flex-col items-center gap-1.5">
                      <DonutChart size={92} strokeWidth={13}
                        segments={[
                          { value: Math.min(avgMin, 60), color: '#8b5cf6' },
                          { value: Math.max(60 - Math.min(avgMin, 60), 0), color: '#ede9fe' },
                        ]}
                        label={`${Math.round(avgMin)}m`}
                      />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata Waktu</span>
                    </div>
                  )}
                </div>
                <div className="mt-5 pt-1 overflow-x-auto">
                  <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sesi</th>
                        <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Peserta</th>
                        <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Avg</th>
                        <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                        <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sesiUrut.map((s: any) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-semibold text-slate-700 truncate max-w-[240px]">{s.name}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{s.total}</td>
                          <td className={`px-3 py-2 text-center font-bold ${s.avg >= 80 ? 'text-emerald-700' : s.avg >= 60 ? 'text-amber-700' : 'text-rose-600'}`}>{s.avg.toFixed(1)}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{s.passed}/{s.total}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{s.avgMin !== null ? `${s.avgMin.toFixed(0)} mnt` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-500 pt-2">Diurutkan dari nilai rata-rata terendah</p>
                </div>
              </div>
            </section>
          );
        })()}

        {divisionStats.length > 0 && (
          <section>
            <SectionHeader><IkonTeks nama="🏢" />Ranking Per Divisi / Jabatan</SectionHeader>
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Sales Division / Jabatan</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Attempt</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">vs Nasional</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {divisionStats.map((d, i) => (
                    <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center text-sm font-black text-slate-500">{i + 1}</td>
                      <td className="px-5 py-3.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">{d.name}</span>
                            {d.source === 'division' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 uppercase tracking-wide">Sales Div</span>
                            )}
                            {d.source === 'jabatan' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">Jabatan</span>
                            )}
                          </div>
                          {d.source === 'division' && d.jabatan && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[220px]">{d.jabatan}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs text-slate-500 font-semibold">{d.total}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full"
                              style={{ width: `${d.avg}%`, background: d.avg >= 80 ? '#10b981' : d.avg >= 60 ? '#f59e0b' : '#f43f5e' }} />
                          </div>
                          <span className={`text-xs font-bold w-8 text-right ${d.avg >= 80 ? 'text-emerald-700' : d.avg >= 60 ? 'text-amber-700' : 'text-rose-600'}`}>
                            {d.avg.toFixed(0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {nationalAvg !== null ? (() => {
                          const gap = d.avg - nationalAvg;
                          return (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gap >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {gap >= 0 ? '▲' : '▼'} {Math.abs(gap).toFixed(1)}
                            </span>
                          );
                        })() : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          d.passRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : d.passRate >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>{d.passRate}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <SectionHeader><IkonTeks nama="🕐" />Aktivitas Terbaru</SectionHeader>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm" style={{ background: 'rgba(255,255,255,0.90)' }}>
            <div className="divide-y divide-slate-100">
              {filteredRecent.length === 0 && (
                <div className="text-center text-slate-500 py-10 text-sm">
                  {search ? 'Tidak ada hasil yang cocok' : 'Belum ada aktivitas quiz'}
                </div>
              )}
              {filteredRecent.slice(0, 10).map((a: any, _ri: number) => {
                const tq = a.total_questions ?? 0;
                const ts = a.time_taken_sec ?? Infinity;
                const isFast = tq >= 5 && ts < tq * 5;
                return (
                  <div key={a.id} className="stagger-item flex items-center gap-4 px-6 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                      {a.users?.full_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.users?.full_name ?? '-'}</p>
                      <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.session_name ?? '-'}</p>
                    </div>
                    <ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} />
                    {isFast && (
                      <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        <Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /> {Math.round(ts)}s
                      </span>
                    )}
                    {(a.tab_switches ?? 0) > 0 && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {a.tab_switches}× tab
                      </span>
                    )}
                    <span className="text-xs text-slate-500 flex-shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      <ModalNilaiPengguna selectedUser={selectedUser} setSelectedUser={setSelectedUser} userAttempts={userAttempts} loadingUser={loadingUser} />
    </div>
  );
}
