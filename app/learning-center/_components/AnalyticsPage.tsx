'use client';

import { useState, useEffect } from 'react';
import { supabase, SearchInput } from './shared';

function DonutChart({ segments, size = 72, strokeWidth = 11, label = '' }: {
  segments: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  label?: string;
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
          const pct = seg.value / total;
          const dash = pct * circ;
          const offset = -(cumBefore / total) * circ;
          cumBefore += seg.value;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset}
            />
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

type TeamFilter = 'PTS' | 'Sales' | 'Marketing';

const TEAM_FILTER_CONFIG: Record<TeamFilter, { label: string; emoji: string; activeClass: string }> = {
  PTS:       { label: 'PTS',       emoji: '🔵', activeClass: 'bg-indigo-600 text-white' },
  Sales:     { label: 'Sales',     emoji: '🟠', activeClass: 'bg-orange-500 text-white' },
  Marketing: { label: 'Marketing', emoji: '🟣', activeClass: 'bg-purple-600 text-white' },
};

function matchesTeamFilter(u: any, filter: TeamFilter): boolean {
  const role = (u.role ?? '').toLowerCase();
  const sd   = u.salesDivision ?? '';
  if (filter === 'PTS')       return role === 'team';
  if (filter === 'Sales')     return ['sales','guest'].includes(role) && !sd.startsWith('Marketing:');
  if (filter === 'Marketing') return ['sales','guest'].includes(role) && sd.startsWith('Marketing:');
  return false;
}

// ─── Team Switch Button ────────────────────────────────────────────────────────
function TeamSwitch({ active, onChange }: { active: TeamFilter; onChange: (t: TeamFilter) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
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

export function AnalyticsPage() {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [allTopUsers, setAllTopUsers] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [divisionStats, setDivisionStats] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<TeamFilter>('PTS');

  // Drill-down state
  const [selectedUser, setSelectedUser] = useState<{ uid: string; name: string } | null>(null);
  const [userAttempts, setUserAttempts] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase
        .from('lc_quiz_attempts')
        .select('user_id, score, passed, started_at, submitted_at, tab_switches, users(full_name, sales_division, team_type, role)')
        .eq('is_submitted', true);

      if (a) {
        // ── Per user ──
        const byUser: Record<string, { name: string; division: string | null; teamType: string | null; role: string | null; salesDivision: string | null; scores: number[]; passed: number; flags: number }> = {};
        a.forEach((att: any) => {
          if (!byUser[att.user_id]) byUser[att.user_id] = {
            name: att.users?.full_name ?? '-',
            division: att.users?.sales_division ?? null,
            teamType: att.users?.team_type ?? null,
            role: att.users?.role ?? null,
            salesDivision: att.users?.sales_division ?? null,
            scores: [], passed: 0, flags: 0,
          };
          byUser[att.user_id].scores.push(att.score ?? 0);
          if (att.passed) byUser[att.user_id].passed++;
          byUser[att.user_id].flags += att.tab_switches ?? 0;
        });
        const allUsers = Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name, division: v.division, teamType: v.teamType,
          role: v.role, salesDivision: v.salesDivision,
          avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
          total: v.scores.length, passed: v.passed, flags: v.flags,
        })).sort((a, b) => b.avg - a.avg);
        setAllTopUsers(allUsers);
        setTopUsers(allUsers.filter(u => matchesTeamFilter(u, 'PTS')).slice(0, 20));

        // ── Per Sales Division ──
        const byDiv: Record<string, { scores: number[]; passed: number; userIds: Set<string> }> = {};
        a.forEach((att: any) => {
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
      }

      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        const stats = await Promise.all(ss.map(async (s: any) => {
          const { data: att } = await supabase
            .from('lc_quiz_attempts')
            .select('score, passed, started_at, submitted_at')
            .eq('quiz_session_id', s.id).eq('is_submitted', true);
          if (!att?.length) return null;
          const avg = att.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / att.length;
          const passed = att.filter((a: any) => a.passed).length;
          const durations = att
            .filter((a: any) => a.started_at && a.submitted_at)
            .map((a: any) => (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000);
          const avgMin = durations.length ? durations.reduce((s: number, d: number) => s + d, 0) / durations.length : null;
          return {
            id: s.id, name: s.session_name,
            total: att.length, avg, passed, failed: att.length - passed,
            avgMin,
            scoreGood: att.filter((a: any) => (a.score ?? 0) >= 80).length,
            scoreMid: att.filter((a: any) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length,
            scoreLow: att.filter((a: any) => (a.score ?? 0) < 60).length,
          };
        }));
        setSessionStats(stats.filter(Boolean));
      }
      setLoading(false);
    };
    load();
  }, []);

  // Re-filter topUsers whenever team switch changes
  useEffect(() => {
    if (allTopUsers.length > 0) {
      setTopUsers(allTopUsers.filter(u => matchesTeamFilter(u, activeTeam)).slice(0, 20));
      setSearch('');
    }
  }, [activeTeam, allTopUsers]);

  // Load detail attempts when a user is selected
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
      .then(({ data }: { data: any[] | null }) => { setUserAttempts(data ?? []); setLoadingUser(false); });
  }, [selectedUser]);

  const filteredUsers = search
    ? topUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : topUsers;


  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📈 Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Performa team & statistik quiz</p>
        </div>
        <div className="flex items-center gap-3">
          <TeamSwitch active={activeTeam} onChange={setActiveTeam} />
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama..." />
        </div>
      </div>

      <div className="p-8 space-y-10">



        {sessionStats.length > 0 && (
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">Statistik Per Sesi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sessionStats.map((s: any) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm font-bold text-slate-800 mb-4 leading-snug line-clamp-2">{s.name}</p>
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <DonutChart
                        segments={[
                          { value: s.passed, color: '#10b981' },
                          { value: s.failed, color: '#f43f5e' },
                        ]}
                        size={68} strokeWidth={10}
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
                        size={68} strokeWidth={10}
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
                          size={68} strokeWidth={10}
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

        {/* ── Top Performers — Team ─────────────────────────────────────── */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-1 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
            🏆 Top Performers — {TEAM_FILTER_CONFIG[activeTeam].label}
          </h3>
          <p className="text-xs text-slate-400 mb-4 ml-1">Klik nama untuk melihat detail nilai & aktivitas per quiz</p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm table-zebra">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Nama</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Score</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, i) => (
                  <tr key={u.uid}
                    className="hover:bg-indigo-50/60 cursor-pointer transition-colors group"
                    onClick={() => setSelectedUser({ uid: u.uid, name: u.name })}>
                    <td className="px-5 py-3.5 text-center text-sm font-black text-slate-300">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{u.name}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-semibold">👁 detail</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-500 text-xs font-semibold">{u.total}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <DonutChart
                          segments={[
                            { value: u.avg, color: u.avg >= 80 ? '#10b981' : u.avg >= 70 ? '#f59e0b' : '#f43f5e' },
                            { value: 100 - u.avg, color: '#f1f5f9' },
                          ]}
                          size={36} strokeWidth={6}
                          label={u.avg.toFixed(0)}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.passed > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                        {u.passed}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {u.flags > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠️ {u.flags}×
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      {loading ? 'Memuat data...' : search ? 'Tidak ada hasil' : `Belum ada data untuk ${TEAM_FILTER_CONFIG[activeTeam].label}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Top Performers — Sales Division ───────────────────────────── */}
        {divisionStats.length > 0 && (
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-1 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">🏢 Top Performers — Sales Division</h3>
            <p className="text-xs text-slate-400 mb-4 ml-1">Ranking performa per divisi penjualan, diurutkan berdasarkan rata-rata nilai</p>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm table-zebra">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Division</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">User</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Pass Rate</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Distribusi Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {divisionStats.map((d: any, i: number) => {
                    const passRate = d.total > 0 ? Math.round(d.passed / d.total * 100) : 0;
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                    return (
                      <tr key={d.div} className="hover:bg-orange-50/40 transition-colors">
                        <td className="px-5 py-3.5 text-center text-sm font-black text-slate-300">{i + 1}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-sm flex-shrink-0">🏢</div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{d.div}</p>
                              {medal && <p className="text-[10px] text-slate-400">{medal} Top {i + 1}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-600">{d.users}</td>
                        <td className="px-5 py-3.5 text-center text-sm font-semibold text-slate-600">{d.total}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <DonutChart
                              segments={[
                                { value: d.avg, color: d.avg >= 80 ? '#10b981' : d.avg >= 70 ? '#f59e0b' : '#f43f5e' },
                                { value: 100 - d.avg, color: '#f1f5f9' },
                              ]}
                              size={40} strokeWidth={7}
                              label={d.avg.toFixed(0)}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-sm font-bold text-emerald-600">{d.passed}</span>
                          <span className="text-xs text-slate-400"> / {d.total}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${passRate >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : passRate >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                            {passRate}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="text-slate-500">≥80: <strong>{d.scoreGood}</strong></span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                              <span className="text-slate-500">60–79: <strong>{d.scoreMid}</strong></span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                              <span className="text-slate-500">&lt;60: <strong>{d.scoreLow}</strong></span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* ─── User Detail Modal ─────────────────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
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
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Quiz', value: userAttempts.length, color: 'text-slate-800' },
                      {
                        label: 'Avg Score',
                        value: userAttempts.length
                          ? (userAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / userAttempts.length).toFixed(1)
                          : '—',
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

                  {/* Per-attempt list */}
                  <div className="space-y-3">
                    {userAttempts.length === 0 && (
                      <p className="text-center text-slate-400 py-8 text-sm">Belum ada quiz yang diselesaikan</p>
                    )}
                    {userAttempts.map(a => {
                      const score = a.score ?? 0;
                      const passing = a.lc_quiz_sessions?.passing_grade ?? 70;
                      const tabSw = a.tab_switches ?? 0;
                      return (
                        <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-sm transition-all">
                          {/* Score donut */}
                          <DonutChart
                            segments={[
                              { value: score, color: score >= passing ? (score >= 80 ? '#10b981' : '#f59e0b') : '#f43f5e' },
                              { value: Math.max(100 - score, 0), color: '#f1f5f9' },
                            ]}
                            size={56} strokeWidth={8}
                            label={score.toFixed(0)}
                          />
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {a.lc_quiz_sessions?.session_name ?? '—'}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{a.lc_quiz_sessions?.materi_name ?? ''}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                                {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                              </span>
                              {a.time_taken_sec != null && (
                                <span className="text-xs text-slate-400">⏱ {Math.floor(a.time_taken_sec / 60)}m {a.time_taken_sec % 60}s</span>
                              )}
                              {tabSw > 0 && (
                                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  ⚠️ {tabSw}× pindah tab
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Right: score detail */}
                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-600">
                              {a.total_correct ?? '?'}/{a.total_questions ?? '?'} benar
                            </p>
                            <p className="text-[10px] text-slate-400">KKM {passing}</p>
                            {a.submitted_at && (
                              <p className="text-[10px] text-slate-300">
                                {new Date(a.submitted_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
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
