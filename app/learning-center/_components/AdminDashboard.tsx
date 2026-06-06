'use client';

import React, { useState, useEffect } from 'react';
import { supabase, User, fmtDate, ScoreBadge, SearchInput } from './shared';

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 68, strokeWidth = 10, label = '' }: {
  segments: { value: number; color: string }[];
  size?: number; strokeWidth?: number; label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] text-slate-300 font-bold">—</span>
    </div>
  );
  let cumBefore = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const offset = -(cumBefore / total) * circ;
          cumBefore += seg.value;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color}
              strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} />
          );
        })}
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-slate-700">{label}</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
      {children}
    </h3>
  );
}

// ─── Team Switch ──────────────────────────────────────────────────────────────
type TeamFilter = 'PTS' | 'Sales' | 'Marketing';

const TEAM_FILTER_CONFIG: Record<TeamFilter, { label: string; emoji: string; activeClass: string }> = {
  PTS:       { label: 'PTS',       emoji: '🔵', activeClass: 'bg-indigo-600 text-white' },
  Sales:     { label: 'Sales',     emoji: '🟠', activeClass: 'bg-orange-500 text-white' },
  Marketing: { label: 'Marketing', emoji: '🟣', activeClass: 'bg-purple-600 text-white' },
};

function isPTSUser(u: any)       { return u.role === 'team'; }
function isSalesUser(u: any)     { return ['sales','guest'].includes((u.role ?? '').toLowerCase()) && !(u.sales_division ?? '').startsWith('Marketing:'); }
function isMarketingUser(u: any) { return ['sales','guest'].includes((u.role ?? '').toLowerCase()) && (u.sales_division ?? '').startsWith('Marketing:'); }

function matchesTeamFilter(u: any, filter: TeamFilter): boolean {
  if (filter === 'PTS')       return isPTSUser(u);
  if (filter === 'Sales')     return isSalesUser(u);
  if (filter === 'Marketing') return isMarketingUser(u);
  return false;
}

function TeamSwitch({ active, onChange }: { active: TeamFilter; onChange: (t: TeamFilter) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 flex-shrink-0">
      {(Object.keys(TEAM_FILTER_CONFIG) as TeamFilter[]).map(t => {
        const cfg = TEAM_FILTER_CONFIG[t];
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              active === t ? cfg.activeClass + ' shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {cfg.emoji} {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({ materials: 0, activeTeam: 0, sessions: 0, attempts: 0 });
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [overviewStats, setOverviewStats] = useState({
    totalUsers: 0, participants: 0,
    passCount: 0, failCount: 0,
    scoreGood: 0, scoreMid: 0, scoreLow: 0,
    submitted: 0, abandoned: 0,
  });

  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [searchPerformer, setSearchPerformer] = useState('');

  const [divisionStats, setDivisionStats] = useState<any[]>([]);
  const [batchPerf, setBatchPerf] = useState<any[]>([]);

  const [selectedUser, setSelectedUser] = useState<{ uid: string; name: string } | null>(null);
  const [userAttempts, setUserAttempts] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamFilter>('PTS');
  const [allTopUsers, setAllTopUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // ── Round 1: counts ────────────────────────────────────────────────────
      const [mat, ses, att, totalUsersRes, abandonedRes] = await Promise.all([
        supabase.from('lc_materials').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }).eq('is_submitted', false),
      ]);
      const { data: teamData } = await supabase.from('lc_quiz_attempts').select('user_id').eq('is_submitted', true);
      const uniqueTeam = new Set((teamData ?? []).map((a: any) => a.user_id)).size;
      setStats({ materials: mat.count ?? 0, activeTeam: uniqueTeam, sessions: ses.count ?? 0, attempts: att.count ?? 0 });

      // ── Round 2: analytics data in parallel ────────────────────────────────
      const [recentRes, allAttRes, qListRes, aListRes] = await Promise.all([
        supabase.from('lc_quiz_attempts')
          .select('*, users(full_name), lc_quiz_sessions(session_name, passing_grade)')
          .eq('is_submitted', true).order('submitted_at', { ascending: false }).limit(50),
        supabase.from('lc_quiz_attempts')
          .select('user_id, score, passed, tab_switches, time_taken_sec, total_questions, users(full_name, jabatan, sales_division, team_type, role)')
          .eq('is_submitted', true),
        supabase.from('lc_questions').select('id, batch_name'),
        supabase.from('lc_answers').select('question_id, is_correct'),
      ]);
      setRecentAttempts(recentRes.data ?? []);

      const allAtt = allAttRes.data ?? [];

      // ── Overview mini pies ─────────────────────────────────────────────────
      const participants = new Set(allAtt.map((a: any) => a.user_id)).size;
      const passCount    = allAtt.filter((a: any) => a.passed).length;
      const scoreGood    = allAtt.filter((a: any) => (a.score ?? 0) >= 80).length;
      const scoreMid     = allAtt.filter((a: any) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length;
      const scoreLow     = allAtt.filter((a: any) => (a.score ?? 0) < 60).length;
      setOverviewStats({
        totalUsers: totalUsersRes.count ?? 0,
        participants,
        passCount,
        failCount: allAtt.length - passCount,
        scoreGood, scoreMid, scoreLow,
        submitted: allAtt.length,
        abandoned: abandonedRes.count ?? 0,
      });

      // ── Top performers + consistency + fast-submit ─────────────────────────
      const byUser: Record<string, {
        name: string; scores: number[]; passed: number; tabSw: number;
        minScore: number; maxScore: number; fastCount: number;
        role: string | null; teamType: string | null; salesDivision: string | null;
      }> = {};
      allAtt.forEach((a: any) => {
        if (!byUser[a.user_id]) byUser[a.user_id] = {
          name: a.users?.full_name ?? '-', scores: [], passed: 0, tabSw: 0,
          minScore: Infinity, maxScore: -Infinity, fastCount: 0,
          role: a.users?.role ?? null,
          teamType: a.users?.team_type ?? null,
          salesDivision: a.users?.sales_division ?? null,
        };
        const sc = a.score ?? 0;
        byUser[a.user_id].scores.push(sc);
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
        total: v.scores.length, passed: v.passed, tabSw: v.tabSw,
        consistency: v.scores.length >= 2 ? v.maxScore - v.minScore : null,
        fastCount: v.fastCount,
      })).sort((a, b) => b.avg - a.avg);
      setAllTopUsers(allUsers);
      setTopUsers(allUsers.filter(u => matchesTeamFilter(u, 'PTS')).slice(0, 20));

      // ── Per division/jabatan ───────────────────────────────────────────────
      // Group key = sales_division if present, else jabatan, else 'Lainnya'
      // Also track the source field so we can label it in the table
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

      // ── Batch/topic performance ────────────────────────────────────────────
      if (qListRes.data && aListRes.data) {
        const qBatch: Record<string, string> = {};
        qListRes.data.forEach((q: any) => { if (q.batch_name) qBatch[q.id] = q.batch_name; });
        const byBatch: Record<string, { correct: number; total: number }> = {};
        aListRes.data.forEach((ans: any) => {
          const bn = qBatch[ans.question_id];
          if (!bn) return;
          if (!byBatch[bn]) byBatch[bn] = { correct: 0, total: 0 };
          byBatch[bn].total++;
          if (ans.is_correct) byBatch[bn].correct++;
        });
        setBatchPerf(Object.entries(byBatch).map(([name, v]) => ({
          name,
          pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
          total: v.total, correct: v.correct,
        })).sort((a, b) => a.pct - b.pct));
      }

      // ── Per session ────────────────────────────────────────────────────────
      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        const sStats = await Promise.all(ss.map(async (s: any) => {
          const { data: sa } = await supabase
            .from('lc_quiz_attempts')
            .select('score, passed, started_at, submitted_at')
            .eq('quiz_session_id', s.id).eq('is_submitted', true);
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
        }));
        setSessionStats(sStats.filter(Boolean));
      }
      setLoadingAnalytics(false);
    };
    load();
  }, []);

  // Re-filter performers when team switch changes
  useEffect(() => {
    if (allTopUsers.length > 0) {
      setTopUsers(allTopUsers.filter(u => matchesTeamFilter(u, activeTeam)).slice(0, 20));
      setSearchPerformer('');
    }
  }, [activeTeam, allTopUsers]);

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
  const filteredPerformers = searchPerformer
    ? topUsers.filter(u => u.name.toLowerCase().includes(searchPerformer.toLowerCase()))
    : topUsers;

  const cards = [
    { label: 'Total Materi', value: stats.materials, icon: '📚', color: 'from-blue-500/90 to-blue-600/90' },
    { label: 'Active Team', value: stats.activeTeam, icon: '👥', color: 'from-violet-500/90 to-violet-600/90' },
    { label: 'Sesi Aktif', value: stats.sessions, icon: '🎯', color: 'from-emerald-500/90 to-emerald-600/90' },
    { label: 'Total Attempt', value: stats.attempts, icon: '📝', color: 'from-amber-500/90 to-amber-600/90' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📊 Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Selamat datang, {user.full_name}</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari aktivitas..." />
      </div>

      <div className="p-8 space-y-10">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {cards.map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* ── Analytics Overview + Top Performers (side by side) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Left: Analytics Overview mini pies */}
          {overviewStats.submitted > 0 && (() => {
            const partPct   = overviewStats.totalUsers > 0 ? Math.round(overviewStats.participants / overviewStats.totalUsers * 100) : 0;
            const passPct   = overviewStats.submitted > 0 ? Math.round(overviewStats.passCount / overviewStats.submitted * 100) : 0;
            const compTotal = overviewStats.submitted + overviewStats.abandoned;
            const compPct   = compTotal > 0 ? Math.round(overviewStats.submitted / compTotal * 100) : 0;
            const miniCards = [
              { title: 'Partisipasi Tim',  sub: `${overviewStats.participants} dari ${overviewStats.totalUsers} anggota`, label: `${partPct}%`,
                segments: [{ value: overviewStats.participants, color: '#6366f1' }, { value: Math.max(overviewStats.totalUsers - overviewStats.participants, 0), color: '#e0e7ff' }] },
              { title: 'Pass Rate Global', sub: `${overviewStats.passCount} lulus · ${overviewStats.failCount} gagal`, label: `${passPct}%`,
                segments: [{ value: overviewStats.passCount, color: '#10b981' }, { value: overviewStats.failCount, color: '#f43f5e' }] },
              { title: 'Distribusi Nilai', sub: `≥80: ${overviewStats.scoreGood} · 60–79: ${overviewStats.scoreMid} · <60: ${overviewStats.scoreLow}`, label: `${overviewStats.submitted}`,
                segments: [{ value: overviewStats.scoreGood, color: '#3b82f6' }, { value: overviewStats.scoreMid, color: '#f59e0b' }, { value: overviewStats.scoreLow, color: '#ef4444' }] },
              { title: 'Completion Rate',  sub: `${overviewStats.abandoned} tidak selesai`, label: `${compPct}%`,
                segments: [{ value: overviewStats.submitted, color: '#10b981' }, { value: overviewStats.abandoned, color: '#cbd5e1' }] },
            ];
            return (
              <div>
                <SectionHeader>🥧 Analytics Overview</SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  {miniCards.map(c => (
                    <div key={c.title} className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center gap-3">
                      <DonutChart segments={c.segments} size={72} strokeWidth={10} label={c.label} />
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700">{c.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{c.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Right: Top Performers */}
          <div className="min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <SectionHeader>🏆 Top Performers</SectionHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <TeamSwitch active={activeTeam} onChange={setActiveTeam} />
                <SearchInput value={searchPerformer} onChange={setSearchPerformer} placeholder="Cari nama..." />
              </div>
            </div>
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                <thead className="border-b border-slate-200 bg-slate-50">
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
                      <td className="px-4 py-3 text-center text-sm font-black text-slate-300">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors text-sm">{u.name}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-semibold">👁</span>
                          {u.consistency !== null && u.consistency > 40 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">⚡ Inkonsisten</span>
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
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⚠️ {u.tabSw}×</span>
                          )}
                          {u.fastCount > 0 && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">🚨 {u.fastCount}×</span>
                          )}
                          {u.tabSw === 0 && u.fastCount === 0 && <span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPerformers.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                      {loadingAnalytics ? 'Memuat data...' : searchPerformer ? 'Tidak ada hasil' : `Belum ada data untuk ${TEAM_FILTER_CONFIG[activeTeam].label}`}
                    </td></tr>
                  )}
                </tbody>
              </table>
              {/* Legend — inside card as footer */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⚠️ N×</span>
                  Pindah tab
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-0.5 font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">🚨 N×</span>
                  Submit &lt;5det/soal
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⚡ Inkonsisten</span>
                  Nilai selisih &gt;40pt
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Session Statistics ── */}
        {sessionStats.length > 0 && (
          <section>
            <SectionHeader>📈 Statistik Per Sesi Quiz</SectionHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sessionStats.map((s: any) => (
                <div key={s.id} className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm font-bold text-slate-800 mb-4 leading-snug line-clamp-2">{s.name}</p>
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <DonutChart
                        segments={[{ value: s.passed, color: '#10b981' }, { value: s.failed, color: '#f43f5e' }]}
                        label={s.total > 0 ? `${Math.round(s.passed / s.total * 100)}%` : '-'}
                      />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lulus</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <DonutChart
                        segments={[
                          { value: s.scoreGood, color: '#3b82f6' },
                          { value: s.scoreMid, color: '#f59e0b' },
                          { value: s.scoreLow, color: '#ef4444' },
                        ]}
                        label={s.avg.toFixed(0)}
                      />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nilai</span>
                    </div>
                    {s.avgMin !== null && (
                      <div className="flex flex-col items-center gap-1">
                        <DonutChart
                          segments={[
                            { value: Math.min(s.avgMin, 60), color: '#8b5cf6' },
                            { value: Math.max(60 - Math.min(s.avgMin, 60), 0), color: '#ede9fe' },
                          ]}
                          label={`${Math.round(s.avgMin)}m`}
                        />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Waktu</span>
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Peserta</span>
                        <span className="font-bold text-slate-700">{s.total}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Avg</span>
                        <span className={`font-bold ${s.avg >= 80 ? 'text-emerald-600' : s.avg >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{s.avg.toFixed(1)}</span>
                      </div>
                      {s.avgMin !== null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Waktu</span>
                          <span className="font-bold text-violet-600">{s.avgMin.toFixed(0)} mnt</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{s.passed} lulus</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{s.failed} gagal</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />≥80: {s.scoreGood}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />60–79: {s.scoreMid}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />&lt;60: {s.scoreLow}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Topic / Batch Performance ── */}
        {batchPerf.length > 0 && (
          <section>
            <SectionHeader>🎯 Knowledge Gap per Topik</SectionHeader>
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              {batchPerf.map(b => (
                <div key={b.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[55%]">{b.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-slate-400">{b.correct}/{b.total} benar</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        b.pct >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : b.pct >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>{b.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full"
                      style={{
                        width: `${b.pct}%`,
                        background: b.pct >= 80 ? '#10b981' : b.pct >= 60 ? '#f59e0b' : '#f43f5e',
                      }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 pt-1">Diurutkan dari topik dengan jawaban benar paling rendah (knowledge gap tertinggi)</p>
            </div>
          </section>
        )}

        {/* ── Per Divisi / Jabatan Ranking ── */}
        {divisionStats.length > 0 && (
          <section>
            <SectionHeader>🏢 Ranking Per Divisi / Jabatan</SectionHeader>
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Sales Division / Jabatan</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Attempt</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {divisionStats.map((d, i) => (
                    <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center text-sm font-black text-slate-300">{i + 1}</td>
                      <td className="px-5 py-3.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">{d.name}</span>
                            {d.source === 'division' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 uppercase tracking-wide">Sales Div</span>
                            )}
                            {d.source === 'jabatan' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">Jabatan</span>
                            )}
                          </div>
                          {d.source === 'division' && d.jabatan && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[220px]">{d.jabatan}</p>
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
                          <span className={`text-xs font-bold w-8 text-right ${d.avg >= 80 ? 'text-emerald-600' : d.avg >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {d.avg.toFixed(0)}
                          </span>
                        </div>
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

        {/* ── Recent Activity ── */}
        <section>
          <SectionHeader>🕐 Aktivitas Terbaru</SectionHeader>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm" style={{ background: 'rgba(255,255,255,0.90)' }}>
            <div className="divide-y divide-slate-100">
              {filteredRecent.length === 0 && (
                <div className="text-center text-slate-400 py-10 text-sm">
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
                        🚨 {Math.round(ts)}s
                      </span>
                    )}
                    {(a.tab_switches ?? 0) > 0 && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        ⚠️ {a.tab_switches}× tab
                      </span>
                    )}
                    <span className="text-xs text-slate-400 flex-shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {/* ── User Detail Modal ── */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h2 className="font-bold text-slate-800 text-lg leading-tight">{selectedUser.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Riwayat semua quiz yang diselesaikan</p>
              </div>
              <button onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all text-lg font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {loadingUser ? (
                <div className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Memuat data...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Quiz', value: userAttempts.length, color: 'text-slate-800' },
                      {
                        label: 'Avg Score',
                        value: userAttempts.length
                          ? (userAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / userAttempts.length).toFixed(1) : '—',
                        color: (() => {
                          if (!userAttempts.length) return 'text-slate-400';
                          const avg = userAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / userAttempts.length;
                          return avg >= 80 ? 'text-emerald-600' : avg >= 70 ? 'text-amber-600' : 'text-rose-600';
                        })(),
                      },
                      { label: 'Lulus', value: userAttempts.filter(a => a.passed).length, color: 'text-emerald-600' },
                      {
                        label: 'Pindah Tab',
                        value: userAttempts.reduce((s, a) => s + (a.tab_switches ?? 0), 0),
                        color: userAttempts.reduce((s, a) => s + (a.tab_switches ?? 0), 0) > 0 ? 'text-amber-600' : 'text-slate-400',
                      },
                    ].map(c => (
                      <div key={c.label} className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
                        <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{c.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {userAttempts.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Belum ada quiz yang diselesaikan</p>}
                    {userAttempts.map(a => {
                      const score   = a.score ?? 0;
                      const passing = a.lc_quiz_sessions?.passing_grade ?? 70;
                      const tabSw   = a.tab_switches ?? 0;
                      const tq      = a.total_questions ?? 0;
                      const ts      = a.time_taken_sec ?? Infinity;
                      const isFast  = tq >= 5 && ts < tq * 5;
                      return (
                        <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                          <DonutChart
                            segments={[
                              { value: score, color: score >= passing ? (score >= 80 ? '#10b981' : '#f59e0b') : '#f43f5e' },
                              { value: Math.max(100 - score, 0), color: '#f1f5f9' },
                            ]}
                            size={56} strokeWidth={8} label={score.toFixed(0)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{a.lc_quiz_sessions?.session_name ?? '—'}</p>
                            <p className="text-xs text-slate-400 truncate">{a.lc_quiz_sessions?.materi_name ?? ''}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                                {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                              </span>
                              {a.time_taken_sec != null && <span className="text-xs text-slate-400">⏱ {Math.floor(a.time_taken_sec / 60)}m {a.time_taken_sec % 60}s</span>}
                              {tabSw > 0 && <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ {tabSw}× tab</span>}
                              {isFast && <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">🚨 Submit terlalu cepat</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-600">{a.total_correct ?? '?'}/{a.total_questions ?? '?'} benar</p>
                            <p className="text-[10px] text-slate-400">KKM {passing}</p>
                            {a.submitted_at && <p className="text-[10px] text-slate-300">{new Date(a.submitted_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
