'use client';

import React, { useState, useEffect } from 'react';
import { supabase, User, fmtDate, ScoreBadge, SearchInput, GradingStatusBadge } from './shared';
import { DonutChart } from '@/components/shared';
import { UserAnswerReview } from './UlasanJawaban';
import { ambilPeringkatSaya, type HasilPeringkat } from '@/lib/kuis/peringkat';
import { isSalesGuest } from '@/lib/constants';
import { Ikon } from '@/components/shared/Ikon';
import { IkonTeks } from '@/components/shared/Ikon';

const AKSEN_KELUARGA: Record<string, string> = {
  emerald: '#059669', amber: '#d97706', rose: '#e11d48', yellow: '#ca8a04', indigo: '#4f46e5',
  slate: '#64748b', blue: '#2563eb', violet: '#7c3aed', red: '#dc2626', green: '#16a34a', sky: '#0284c7',
};
function aksenDariGradien(kelas: string): string {
  const m = kelas.match(/from-([a-z]+)-/);
  return (m && AKSEN_KELUARGA[m[1]]) || '#4f46e5';
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-xs backdrop-blur-xs">
      {children}
    </h3>
  );
}

export function ScorePage({ user }: { user: User }) {
  const [attempts, setAttempts]       = useState<any[]>([]);
  const [peringkat, setPeringkat]     = useState<HasilPeringkat | null>(null);
  const [viewingAttempt, setViewingAttempt] = useState<any | null>(null);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    const load = async () => {
      const myRes = await supabase.from('lc_quiz_attempts')
        .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
        .eq('user_id', user.id).eq('is_submitted', true)
        .order('submitted_at', { ascending: false });
      setAttempts(myRes.data ?? []);

      setPeringkat(await ambilPeringkatSaya());
    };
    load();
  }, [user.id]);

  const gradedAttempts = attempts.filter((a) => a.grading_status !== 'pending_review');
  const total      = gradedAttempts.length;
  const avg        = total ? gradedAttempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / total : 0;
  const passed     = gradedAttempts.filter((a) => a.passed).length;
  const scoreGood  = gradedAttempts.filter((a) => (a.score ?? 0) >= 80).length;
  const scoreMid   = gradedAttempts.filter((a) => (a.score ?? 0) >= 60 && (a.score ?? 0) < 80).length;
  const scoreLow   = gradedAttempts.filter((a) => (a.score ?? 0) < 60).length;
  const passPct    = total > 0 ? Math.round(passed / total * 100) : 0;
  const papan      = peringkat?.papan ?? [];
  const pakaiDivisi = isSalesGuest({ role: user.role });
  const myRank     = peringkat?.globalRank ?? 0;
  const rankTotal  = peringkat?.globalTotal ?? 0;
  const rankPct    = rankTotal > 0 && myRank > 0
    ? Math.round((rankTotal - myRank + 1) / rankTotal * 100) : 0;

  const filtered = search
    ? attempts.filter(a =>
        (a.lc_quiz_sessions?.session_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.lc_quiz_sessions?.materi_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : attempts;

  if (viewingAttempt) {
    return <UserAnswerReview user={user} onBack={() => setViewingAttempt(null)} isAdminView={false} autoOpenAttemptId={viewingAttempt.id} />;
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
      sub: rankTotal > 0 && myRank > 0 ? `#${myRank} dari ${rankTotal} peserta` : 'Belum ada data',
      label: rankPct > 0 ? `${rankPct}%` : '—',
      segments: rankTotal > 0 && myRank > 0
        ? [{ value: rankTotal - myRank + 1, color: '#6366f1' }, { value: myRank - 1, color: '#e0e7ff' }]
        : [{ value: 1, color: '#e0e7ff' }] },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">Dashboard Saya</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Analitik performa quiz kamu</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari sesi atau materi..." />
      </div>

      <div className="p-4 sm:p-8 space-y-8">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {summaryCards.map(c => {
            const aksen = aksenDariGradien(c.color);
            return (
              <div key={c.label} className="relative overflow-hidden rounded-xl bg-white border border-slate-200 px-4 py-3.5 sm:px-5 sm:py-4"
                style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}>
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: aksen }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xl sm:text-[28px] font-bold tracking-tight text-slate-900 leading-none">{c.value}</div>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${aksen}14`, color: aksen }}>
                    <Ikon nama={c.icon} ukuran={16} />
                  </span>
                </div>
                <div className="text-[12px] sm:text-[13px] font-semibold text-slate-600 mt-1.5">{c.label}</div>
              </div>
            );
          })}
        </div>

        {total > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <div>
              <SectionHeader><IkonTeks nama="🥧" />Analytics Saya</SectionHeader>
              <div className="grid grid-cols-2 gap-3">
                {miniPies.map(c => (
                  <div key={c.title} className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col items-center gap-2.5">
                    <DonutChart segments={c.segments} size={68} strokeWidth={9} label={c.label} />
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-700">{c.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHeader><IkonTeks nama="🏆" />Peringkat — {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Semua'}</SectionHeader>
              <p className="text-[11px] text-slate-500 mb-3 -mt-2 leading-relaxed">
                Urutan: <b className="text-slate-500">skor rata-rata</b> tertinggi dulu → kalau seri,{' '}
                <b className="text-slate-500">waktu pengerjaan</b> tercepat menang → kalau keduanya sama persis,
                peringkatnya <b className="text-slate-500">kembar</b> (nomor yang sama, bukan diacak).
                Peringkat dihitung ulang tiap halaman dibuka dan hasilnya selalu sama untuk data yang sama.
              </p>

              <div className={`grid grid-cols-1 ${pakaiDivisi ? 'sm:grid-cols-2' : ''} gap-3 mb-3`}>
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs p-4 text-center">
                  <div className="text-xl mb-0.5"><Ikon nama="🏆" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                  <div className="text-lg sm:text-2xl font-black text-indigo-700">{myRank > 0 ? `#${myRank}` : '—'}</div>
                  <p className="text-xs text-slate-500 mt-1">
                    {rankTotal ? `dari ${rankTotal} peserta ${user.role}` : 'Belum ada data'}
                  </p>
                </div>
                {pakaiDivisi && (
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs p-4 text-center">
                  <div className="text-xl mb-0.5"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                  <div className="text-lg sm:text-2xl font-black text-indigo-700">
                    {peringkat?.divisiRank ? `#${peringkat.divisiRank}` : '—'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {peringkat?.divisi
                      ? (peringkat.divisiTotal ? `dari ${peringkat.divisiTotal} peserta divisi ${peringkat.divisi}` : `Belum ada peserta lain di divisi ${peringkat.divisi}`)
                      : 'Divisi belum diset di profil kamu'}
                  </p>
                </div>
                )}
              </div>

              <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto">
                <table className="w-full text-sm table-zebra" style={{ minWidth: '340px' }}>
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Nama</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Quiz</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Score</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest" title="Rata-rata waktu pengerjaan - penentu urutan saat skor sama">Waktu</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Lulus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {papan.map((r, iBaris) => (
                      <tr key={r.aku ? 'aku' : `b${iBaris}`}
                        className={`stagger-item ${r.aku ? 'bg-indigo-50 border-l-[3px] border-indigo-400' : 'hover:bg-slate-50'} ${
                          r.disisipkan ? 'border-t-2 border-dashed border-indigo-300' : ''
                        }`}>
                        <td className={`px-3 py-3 text-center font-black text-sm ${r.aku ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {r.belumDinilai ? '—' : r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {r.aku ? (
                              <>
                                <span className="font-semibold text-sm text-indigo-700">{r.nama}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200">KAMU</span>
                                {r.belumDinilai && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">BELUM DINILAI</span>
                                )}
                              </>
                            ) : (
                              <span className="font-semibold text-sm text-slate-500 select-none" style={{ filter: 'blur(4px)', userSelect: 'none' }}>
                                {r.nama}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-slate-500">{r.quiz}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-bold ${r.avg >= 80 ? 'text-emerald-700' : r.avg >= 60 ? 'text-amber-700' : 'text-rose-600'}`}>
                            {r.avg.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">
                          {r.belumDinilai || !r.avgWaktu
                            ? '—'
                            : `${Math.floor(r.avgWaktu / 60)}m ${String(r.avgWaktu % 60).padStart(2, '0')}s`}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${r.lulus > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {r.lulus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {papan.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-500 text-sm">Belum ada data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {attempts.length > 0 && (
          <section>
            <SectionHeader><IkonTeks nama="🕐" />Aktivitas Terbaru Saya</SectionHeader>
            <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {attempts.slice(0, 5).map((a) => {
                const pending = a.grading_status === 'pending_review';
                const score   = a.score ?? 0;
                const passing = a.lc_quiz_sessions?.passing_grade ?? 70;
                return (
                  <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0
                      ${pending ? 'bg-amber-100 text-amber-700' : score >= passing ? (score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') : 'bg-rose-100 text-rose-600'}`}>
                      {pending ? '⏳' : score.toFixed(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.lc_quiz_sessions?.session_name ?? '—'}</p>
                      <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.materi_name ?? ''}</p>
                    </div>
                    <GradingStatusBadge attempt={a} />
                    <span className="text-xs text-slate-500 shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <SectionHeader><IkonTeks nama="📋" />Rekap Nilai Per Quiz</SectionHeader>
          <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto">
            <table className="w-full text-sm table-zebra" style={{ minWidth: '520px' }}>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest whitespace-nowrap"
                    title="Peringkat kamu DI SESI INI SAJA. Angka ini tidak ikut berubah ketika ada sesi quiz lain berjalan.">
                    Peringkat Sesi
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                    {search ? 'Tidak ada hasil' : 'Belum ada quiz yang diselesaikan'}
                  </td></tr>
                )}
                {filtered.map((a) => {
                  const ps = peringkat?.peringkatSesi?.[a.id];
                  return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {ps
                        ? <span className="inline-flex items-baseline gap-1">
                            <span className={`text-sm font-black ${ps.rank === 1 ? 'text-amber-700' : ps.rank <= 3 ? 'text-slate-600' : 'text-slate-700'}`}>
                              {ps.rank <= 3 ? ['🥇','🥈','🥉'][ps.rank - 1] : `#${ps.rank}`}
                            </span>
                            <span className="text-[11px] text-slate-500">dari {ps.total}</span>
                          </span>
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} /></td>
                    <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                    <td className="px-5 py-3.5 text-center">
                      <GradingStatusBadge attempt={a} />
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <button onClick={() => setViewingAttempt(a)}
                        className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                        <IkonTeks nama="📋" />Review
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
