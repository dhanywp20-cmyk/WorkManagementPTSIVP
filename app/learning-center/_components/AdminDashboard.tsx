'use client';

import React, { useState, useEffect } from 'react';
import { TeamSwitch, matchesTeamFilter, TEAM_FILTER_CONFIG, type TeamFilter } from './team-filter';
import { useKelompokCabang } from '@/lib/kelompok';
import { supabase, User, fmtDate, ScoreBadge, SearchInput } from './shared';
import { StatCardGrid, ModalPortal, DonutChart } from '@/components/shared';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
      {children}
    </h3>
  );
}

// Main Dashboard
export function AdminDashboard({ user }: { user: User }) {
  // Berlangganan daftar kelompok "PTS Cabang" supaya penyaringan dihitung
  // ulang begitu daftarnya selesai dimuat (lihat catatan di useEffect saring).
  // Dipakai sebagai kunci string, bukan lariknya langsung: pakai() membuat
  // larik BARU tiap pemberitahuan, jadi larik mentah akan memicu efek walau
  // isinya sama persis.
  const kunciCabang = useKelompokCabang().map(k => k.nama).join('|');
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
  const [nationalAvg, setNationalAvg] = useState<number | null>(null);
  const [performerDivisionFilter, setPerformerDivisionFilter] = useState<string>('');

  const [selectedUser, setSelectedUser] = useState<{ uid: string; name: string } | null>(null);
  const [userAttempts, setUserAttempts] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamFilter>('PTS');
  const [allTopUsers, setAllTopUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // Round 1: counts
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

      // Round 2: analytics data in parallel
      const [recentRes, allAttRes, usersRes] = await Promise.all([
        supabase.from('lc_quiz_attempts')
          .select('*, users(full_name), lc_quiz_sessions(session_name, passing_grade)')
          .eq('is_submitted', true).order('submitted_at', { ascending: false }).limit(50),
        // Dua hal yang DISENGAJA di query ini:
        //
        // 1. '*' - bukan daftar kolom eksplisit. PostgREST menolak SELURUH
        //    query bila satu kolom belum ada di skema, jadi menyebut
        //    grading_status membuat tabel kosong total sebelum migrasi essay
        //    dijalankan, tanpa pesan error apa pun.
        //
        // 2. TANPA embed users(...). Data user diambil terpisah lalu digabung
        //    di JS. Embed bergantung pada relasi FK yang terbaca PostgREST;
        //    kalau embed gagal, a.users bernilai null sehingga role ikut null
        //    dan SELURUH tab (PTS/Sales/Marketing) kosong - tanpa error.
        //    Query terpisah juga lebih hemat: data user tidak diulang di
        //    setiap baris attempt.
        supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
        supabase.from('users').select('id, full_name, jabatan, sales_division, team_type, role'),
      ]);
      setRecentAttempts(recentRes.data ?? []);

      // Peta user dipakai menggantikan embed users(...) - lihat catatan query di atas.
      const userMap: Record<string, any> = {};
      (usersRes.data ?? []).forEach((u: any) => { userMap[u.id] = u; });

      const allAtt = (allAttRes.data ?? [])
        .filter((a: any) => a.grading_status !== 'pending_review') // essay belum dinilai jangan masuk statistik
        .map((a: any) => ({ ...a, users: userMap[a.user_id] ?? null }));

      // Overview mini pies
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

      // Top performers + consistency + fast-submit
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

      // Per division/jabatan
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

      // Nasional (semua divisi/jabatan digabung) - pembanding gap tiap kelompok
      const allScoresNational = allAtt.map((a: any) => a.score ?? 0);
      setNationalAvg(allScoresNational.length ? allScoresNational.reduce((s: number, n: number) => s + n, 0) / allScoresNational.length : null);

      // Per session
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
    // Pindah dari Sales ke tab lain: buang sisa pilihan divisi, kalau tidak
    // tabel PTS/Marketing ikut tersaring habis oleh divisi yang tidak berlaku.
    if (activeTeam !== 'Sales' && performerDivisionFilter) setPerformerDivisionFilter('');
      setSearchPerformer('');
    }
    // kunciCabang ikut jadi pemicu: daftar kelompok dimuat ASINKRON, sering
    // selesai SESUDAH data attempt. Tanpa ini, saat kelompok telat datang
    // anggota PTS Daerah terlanjur ikut terhitung di tab PTS dan tidak pernah
    // dihitung ulang sampai pengguna menekan tab lain - persis kelirunya
    // yang tidak kelihatan salah di layar.
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
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">📊 Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Selamat datang, {user.full_name}</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari aktivitas..." />
      </div>

      <div className="p-4 sm:p-8 space-y-10">

        {/* ── Summary Cards ── */}
        <StatCardGrid cols={4} items={cards} />

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
            {/* Semua kontrol MENYATU di dalam kartu tabel: judul + rata-rata
                nasional di kiri, tab/filter/pencarian di kanan. Sebelumnya
                judul, pencarian, dan rata-rata nasional melayang sebagai blok
                terpisah di atas kartu sehingga tampak tercerai-berai. */}
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Kiri: judul + rata-rata nasional */}
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    🏆 Top Performers
                  </span>
                  {nationalAvg !== null && (
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      🌏 Nasional: <span className="font-bold text-slate-800">{nationalAvg.toFixed(1)}</span>
                      {activeTeam === 'Sales' && performerDivisionFilter && (() => {
                        const d = divisionStats.find(d => d.name === performerDivisionFilter);
                        if (!d) return null;
                        const gap = d.avg - nationalAvg;
                        return (
                          <span className={`ml-1.5 font-bold ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            · {performerDivisionFilter} {d.avg.toFixed(1)} ({gap >= 0 ? '▲' : '▼'}{Math.abs(gap).toFixed(1)})
                          </span>
                        );
                      })()}
                    </span>
                  )}
                </div>

                {/* Kanan: tab, filter divisi, pencarian — satu baris */}
                <div className="flex items-center gap-2 flex-wrap">
                  <TeamSwitch active={activeTeam} onChange={setActiveTeam} />
                  {/* Tempat dropdown tetap dipesan di tab non-Sales supaya tinggi
                      header tidak berubah saat berpindah tab. */}
                  <select aria-label="Filter divisi" value={performerDivisionFilter} onChange={e => setPerformerDivisionFilter(e.target.value)}
                    disabled={activeTeam !== 'Sales'}
                    aria-hidden={activeTeam !== 'Sales'}
                    className={`text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400 bg-white font-semibold text-slate-600 ${activeTeam === 'Sales' && divisionStats.length > 0 ? '' : 'invisible pointer-events-none'}`}>
                    <option value="">🏢 Semua Divisi</option>
                    {divisionStats.filter(d => d.source === 'division').map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                  <SearchInput value={searchPerformer} onChange={setSearchPerformer} placeholder="Cari nama..." />
                </div>
              </div>

              <div className="overflow-x-auto">
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
              </div>{/* tutup overflow-x-auto pembungkus tabel */}
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
        {sessionStats.length > 0 && (() => {
          /*
            SATU ringkasan gabungan, bukan satu kartu-berisi-3-donut PER SESI
            seperti sebelumnya - begitu sesi quiz sudah puluhan/ratusan (wajar
            kalau platform ini sudah jalan lama), grid kartu itu jadi sangat
            panjang tanpa menambah informasi baru. Angka & donut di sini
            dijumlah dari sessionStats yang sama persis (tidak query ulang),
            lalu daftar sesinya sendiri ditaruh di TABEL ringkas di bawahnya -
            satu baris per sesi, bukan satu kartu besar per sesi.
          */
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
              <SectionHeader>📈 Statistik Per Sesi Quiz</SectionHeader>
              <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                {/*
                  Tanpa StatCardGrid Total Sesi/Peserta/Rata-rata/Pass Rate di
                  sini - itu duplikat dari "Summary Cards" & "Analytics
                  Overview" (Pass Rate Global, Distribusi Nilai) yang sudah
                  ada di atas. Donut di bawah ini tetap ada karena scope-nya
                  beda: overview di atas itu SELURUH attempt platform,
                  sedangkan ini KHUSUS sesi quiz yang formal (lc_quiz_sessions),
                  jadi angkanya bisa berbeda dan tetap relevan dilihat.
                */}
                <div className="flex flex-wrap items-start gap-8">
                  <div className="flex flex-col items-center gap-1.5">
                    <DonutChart size={92} strokeWidth={13}
                      segments={[{ value: totalPassed, color: '#10b981' }, { value: totalFailed, color: '#f43f5e' }]}
                      label={totalPeserta > 0 ? `${Math.round(totalPassed / totalPeserta * 100)}%` : '-'}
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lulus vs Gagal</span>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{totalPassed} lulus</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{totalFailed} gagal</span>
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sebaran Nilai</span>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />≥80: {scoreGood}</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />60–79: {scoreMid}</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />&lt;60: {scoreLow}</span>
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rata-rata Waktu</span>
                    </div>
                  )}
                </div>
                {/* Rincian per sesi - TABEL ringkas (satu baris per sesi), bukan kartu besar per sesi. */}
                <div className="mt-5 pt-1 overflow-x-auto">
                  <table className="w-full text-sm table-zebra" style={{ minWidth: '480px' }}>
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sesi</th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peserta</th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg</th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lulus</th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sesiUrut.map((s: any) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-semibold text-slate-700 truncate max-w-[240px]">{s.name}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{s.total}</td>
                          <td className={`px-3 py-2 text-center font-bold ${s.avg >= 80 ? 'text-emerald-600' : s.avg >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{s.avg.toFixed(1)}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{s.passed}/{s.total}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{s.avgMin !== null ? `${s.avgMin.toFixed(0)} mnt` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 pt-2">Diurutkan dari nilai rata-rata terendah</p>
                </div>
              </div>
            </section>
          );
        })()}

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
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">vs Nasional</th>
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
                        {nationalAvg !== null ? (() => {
                          const gap = d.avg - nationalAvg;
                          return (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gap >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {gap >= 0 ? '▲' : '▼'} {Math.abs(gap).toFixed(1)}
                            </span>
                          );
                        })() : <span className="text-slate-300 text-xs">—</span>}
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
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h2 className="font-bold text-slate-800 text-lg leading-tight">{selectedUser.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Riwayat semua quiz yang diselesaikan</p>
              </div>
              <button aria-label="Tutup" onClick={() => setSelectedUser(null)}
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
      </ModalPortal>
      )}
    </div>
  );
}
