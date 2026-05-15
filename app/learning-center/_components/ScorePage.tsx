'use client';

import React, { useState, useEffect } from 'react';
import { supabase, User, fmtDate, ScoreBadge, SearchInput } from './shared';
import { UserAnswerReview } from './TeamPage';

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

// ─── Personal Dashboard ───────────────────────────────────────────────────────
export function ScorePage({ user }: { user: User }) {
  const [attempts, setAttempts]       = useState<any[]>([]);
  const [rankings, setRankings]       = useState<any[]>([]);
  const [viewingAttempt, setViewingAttempt] = useState<any | null>(null);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    const load = async () => {
      const [myRes, allRes] = await Promise.all([
        supabase.from('lc_quiz_attempts')
          .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
          .eq('user_id', user.id).eq('is_submitted', true)
          .order('submitted_at', { ascending: false }),
        supabase.from('lc_quiz_attempts')
          .select('user_id, score, passed, users(full_name)')
          .eq('is_submitted', true),
      ]);
      setAttempts(myRes.data ?? []);

      if (allRes.data) {
        const byUser: Record<string, { name: string; scores: number[]; passed: number }> = {};
        allRes.data.forEach((a: any) => {
          if (!byUser[a.user_id]) byUser[a.user_id] = { name: a.users?.full_name ?? '-', scores: [], passed: 0 };
          byUser[a.user_id].scores.push(a.score ?? 0);
          if (a.passed) byUser[a.user_id].passed++;
        });
        setRankings(Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name,
          avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
          total: v.scores.length, passed: v.passed,
        })).sort((a, b) => b.avg - a.avg));
      }
    };
    load();
  }, [user.id]);

  // ── computed ────────────────────────────────────────────────────────────────
  const total      = attempts.length;
  const avg        = total ? attempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / total : 0;
  const passed     = attempts.filter((a: any) => a.passed).length;
  const scoreGood  = attempts.filter((a: any) => (a.score ?? 0) >= 80).length;
  const scoreMid   = attempts.filter((a: any) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length;
  const scoreLow   = attempts.filter((a: any) => (a.score ?? 0) < 60).length;
  const passPct    = total > 0 ? Math.round(passed / total * 100) : 0;
  const myRank     = rankings.findIndex(r => r.uid === user.id) + 1; // 1-based, 0 = not found
  const rankPct    = rankings.length > 0 && myRank > 0
    ? Math.round((rankings.length - myRank + 1) / rankings.length * 100) : 0;

  const filtered = search
    ? attempts.filter(a =>
        (a.lc_quiz_sessions?.session_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.lc_quiz_sessions?.materi_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : attempts;

  if (viewingAttempt) {
    return <UserAnswerReview user={user} onBack={() => setViewingAttempt(null)} isAdminView={false} />;
  }

  const summaryCards = [
    { label: 'Quiz Diikuti',   value: total,          icon: '📝', color: 'from-blue-500/90 to-blue-600/90' },
    { label: 'Rata-rata Skor', value: avg.toFixed(1), icon: '📊',
      color: avg >= 80 ? 'from-emerald-500/90 to-emerald-600/90' : avg >= 60 ? 'from-amber-500/90 to-amber-600/90' : 'from-rose-500/90 to-rose-600/90' },
    { label: 'Total Lulus',    value: passed,          icon: '✅', color: 'from-emerald-500/90 to-emerald-600/90' },
    { label: 'Ranking',
      value: myRank > 0 ? `#${myRank}` : '—', icon: '🏅',
      color: myRank === 1 ? 'from-yellow-400/90 to-amber-500/90' : myRank <= 3 ? 'from-indigo-500/90 to-violet-500/90' : 'from-slate-500/90 to-slate-600/90' },
  ];

  const miniPies = [
    { title: 'Pass Rate', sub: `${passed} lulus · ${total - passed} gagal`, label: `${passPct}%`,
      segments: [{ value: passed, color: '#10b981' }, { value: Math.max(total - passed, 0), color: '#f43f5e' }] },
    { title: 'Avg Score', sub: `dari ${total} quiz`, label: avg.toFixed(0),
      segments: [{ value: avg, color: avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#f43f5e' }, { value: Math.max(100 - avg, 0), color: '#f1f5f9' }] },
    { title: 'Distribusi Nilai', sub: `≥80: ${scoreGood} · 60–79: ${scoreMid} · <60: ${scoreLow}`, label: `${total}`,
      segments: [{ value: scoreGood, color: '#3b82f6' }, { value: scoreMid, color: '#f59e0b' }, { value: scoreLow, color: '#ef4444' }] },
    { title: 'Posisi Top',
      sub: rankings.length > 0 && myRank > 0 ? `#${myRank} dari ${rankings.length} peserta` : 'Belum ada data',
      label: rankPct > 0 ? `${rankPct}%` : '—',
      segments: rankings.length > 0 && myRank > 0
        ? [{ value: rankings.length - myRank + 1, color: '#6366f1' }, { value: myRank - 1, color: '#e0e7ff' }]
        : [{ value: 1, color: '#e0e7ff' }] },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📊 Dashboard Saya</h1>
          <p className="text-sm text-slate-500 mt-0.5">Analitik performa quiz kamu</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari sesi atau materi..." />
      </div>

      <div className="p-8 space-y-8">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {summaryCards.map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* ── Analytics + Leaderboard ── */}
        {total > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Left: mini pies 2x2 */}
            <div>
              <SectionHeader>🥧 Analytics Saya</SectionHeader>
              <div className="grid grid-cols-2 gap-3">
                {miniPies.map(c => (
                  <div key={c.title} className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center gap-2.5">
                    <DonutChart segments={c.segments} size={68} strokeWidth={9} label={c.label} />
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-700">{c.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Leaderboard with user's row highlighted */}
            <div>
              <SectionHeader>🏆 Posisi Kamu di Leaderboard</SectionHeader>
              <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-sm table-zebra" style={{ minWidth: '300px' }}>
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Nama</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Avg</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rankings.map((r, i) => {
                      const isMe = r.uid === user.id;
                      // Mask name: show only initials for other participants
                      const maskedName = r.name.split(' ').map((w: string) => w[0] + '***').join(' ');
                      return (
                        <tr key={r.uid} className={`stagger-item ${isMe ? 'bg-indigo-50 border-l-[3px] border-indigo-400' : 'hover:bg-slate-50'}`}>
                          <td className={`px-4 py-3 text-center font-black text-sm ${isMe ? 'text-indigo-600' : 'text-slate-300'}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isMe ? (
                                <span className="font-semibold text-sm text-indigo-700">{r.name}</span>
                              ) : (
                                <span className="font-semibold text-sm text-slate-400 select-none" style={{ filter: 'blur(4px)', userSelect: 'none' }}>
                                  {maskedName}
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200">KAMU</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold ${r.avg >= 80 ? 'text-emerald-600' : r.avg >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {r.avg.toFixed(0)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${r.passed > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                              {r.passed}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {rankings.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Belum ada data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Recent Activity (own, last 5) ── */}
        {attempts.length > 0 && (
          <section>
            <SectionHeader>🕐 Aktivitas Terbaru Saya</SectionHeader>
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {attempts.slice(0, 5).map((a: any) => {
                const score   = a.score ?? 0;
                const passing = a.lc_quiz_sessions?.passing_grade ?? 70;
                return (
                  <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0
                      ${score >= passing ? (score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') : 'bg-rose-100 text-rose-600'}`}>
                      {score.toFixed(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.lc_quiz_sessions?.session_name ?? '—'}</p>
                      <p className="text-xs text-slate-400 truncate">{a.lc_quiz_sessions?.materi_name ?? ''}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0
                      ${a.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Full Rekap Table ── */}
        <section>
          <SectionHeader>📋 Rekap Nilai Per Quiz</SectionHeader>
          <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm table-zebra" style={{ minWidth: '520px' }}>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">
                    {search ? 'Tidak ada hasil' : 'Belum ada quiz yang diselesaikan'}
                  </td></tr>
                )}
                {filtered.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</td>
                    <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} /></td>
                    <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                        {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <button onClick={() => setViewingAttempt(a)}
                        className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                        📋 Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
