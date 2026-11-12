'use client';

import { useState, useEffect } from 'react';
import { supabase, User, QuizSession, fmtDate, ScoreBadge, SearchInput, BtnView, GradingStatusBadge } from './shared';
import { UserAnswerReview } from './UlasanJawaban';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export function ReportPage({ initialSessionId, onSessionConsumed }: {
  currentUser: User;
  initialSessionId?: string | null;
  onSessionConsumed?: () => void;
}) {
  const [data, setData] = useState<any[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [viewingUser, setViewingUser] = useState<{ user: User; attemptId: string } | null>(null);
  const [search, setSearch] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false })
      .then(({ data: s }) => setSessions((s ?? []) as QuizSession[]));
  }, []);

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSession(initialSessionId);
      onSessionConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  useEffect(() => {
    if (!selectedSession) { setData([]); setLoadErr(null); return; }
    let dibatalkan = false;
    (async () => {
      setLoading(true); setLoadErr(null);
      const { data: attempts, error } = await supabase
        .from('lc_quiz_attempts')
        .select('*')
        .eq('quiz_session_id', selectedSession)
        .eq('is_submitted', true)
        .order('score', { ascending: false })
        .order('time_taken_sec', { ascending: true })
        .order('id', { ascending: true });
      if (dibatalkan) return;
      if (error) {
        setLoadErr(error.message); setData([]); setLoading(false);
        return;
      }
      const rows = attempts ?? [];
      const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
      const userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: us } = await supabase
          .from('users').select('id, full_name, username, jabatan, role, sales_division').in('id', userIds);
        (us ?? []).forEach((u) => { userMap[u.id] = u; });
      }
      if (dibatalkan) return;
      setData(rows.map((r) => ({ ...r, users: (r.user_id ? userMap[r.user_id] : undefined) ?? null })));
      setLoading(false);
    })();
    return () => { dibatalkan = true; };
  }, [selectedSession]);

  const session = sessions.find(s => s.id === selectedSession);

  if (viewingUser) {
    return <UserAnswerReview user={viewingUser.user} onBack={() => setViewingUser(null)} isAdminView={true}
      autoOpenAttemptId={viewingUser.attemptId} />;
  }

  const filtered = search
    ? data.filter(a =>
        (a.users?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.users?.username ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const peringkatPerAttempt = new Map<string, number>();
  {
    let nomor = 0;
    data.forEach((a: any, i: number) => {
      const sblm: any = i > 0 ? data[i - 1] : null;
      const seri = sblm && Number(sblm.score) === Number(a.score) && sblm.time_taken_sec === a.time_taken_sec;
      if (!seri) nomor = i + 1;
      peringkatPerAttempt.set(a.id, nomor);
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight"><IkonTeks nama="📋" />Laporan</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Hasil quiz per sesi</p>
          <div className="mt-2">
            <select aria-label="-- Pilih Sesi --" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
              className="w-full sm:min-w-[320px] sm:w-auto border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-hidden focus:border-blue-400 bg-white">
              <option value="">-- Pilih Sesi --</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_type === 'essay' ? '📝 ' : ''}{s.session_name}</option>)}
            </select>
          </div>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari peserta..." />
      </div>
      <div className="p-4 sm:p-8 space-y-6">

        {data.length > 0 && (
          <>
            {(() => {
              const graded = data.filter((a) => a.grading_status !== 'pending_review');
              const pendingCount = data.length - graded.length;
              const cards = [
                { label: 'Peserta', value: data.length },
                { label: 'Rata-rata', value: graded.length ? (graded.reduce((s: number, a: any) => s+(a.score??0),0)/graded.length).toFixed(1) : '—' },
                { label: 'Lulus', value: graded.filter((a) => a.passed).length },
                { label: 'Pass Rate', value: graded.length ? `${Math.round(graded.filter((a) => a.passed).length/graded.length*100)}%` : '—' },
              ];
              if (session?.session_type === 'essay') cards.push({ label: '⏳ Menunggu Dinilai', value: pendingCount });
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {cards.map(c => (
                    <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs text-center">
                      <div className="text-lg sm:text-2xl font-black text-slate-800">{c.value}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto"
              style={{ background: '#ffffff' }}>
              <table className="w-full text-sm table-zebra" style={{ minWidth: '680px' }}>
                <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10"
                      title="Diurutkan dari skor tertinggi. Jika skor sama, waktu pengerjaan tercepat menang.">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Peserta</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Flags</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Waktu</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-slate-500">Tidak ada peserta yang cocok</td></tr>
                  )}
                  {filtered.map((a) => {
                    const pr = peringkatPerAttempt.get(a.id) ?? 0;
                    return (
                    <tr key={a.id} className="stagger-item hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mx-auto ${pr === 1 ? 'bg-amber-400 text-white' : pr === 2 ? 'bg-slate-400 text-white' : pr === 3 ? 'bg-orange-400 text-white' : 'text-slate-500'}`}>
                          {pr <= 3 ? ['🥇','🥈','🥉'][pr - 1] : pr}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {a.users?.full_name ?? <span className="text-slate-500 italic font-normal">(nama tidak termuat)</span>}
                        {a.users?.sales_division && (
                          <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 align-middle">
                            {a.users.sales_division}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                      <td className="px-5 py-3.5 text-center">
                        {a.grading_status === 'pending_review'
                          ? <span className="text-xs text-amber-700 font-bold"><IkonTeks nama="⏳" />—</span>
                          : <ScoreBadge score={a.score} passing={session?.passing_grade ?? 70} />}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <GradingStatusBadge attempt={a} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {(() => {
                          const tabSw = a.tab_switches ?? 0;
                          const tq = a.total_questions ?? 0;
                          const ts = a.time_taken_sec ?? Infinity;
                          const isFast = tq >= 5 && ts < tq * 5;
                          if (!tabSw && !isFast) return <span className="text-slate-400 text-sm">—</span>;
                          return (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {isFast && (
                                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  <Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /> {Math.round(ts)}s
                                </span>
                              )}
                              {tabSw > 0 && (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {tabSw}× tab
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.time_taken_sec ? `${Math.floor(a.time_taken_sec/60)}m ${a.time_taken_sec%60}s` : '—'}</td>
                      <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {(() => {
                          const peserta = (a.users ?? { id: a.user_id, full_name: a.user_id ? '(nama tidak termuat)' : '—', username: '', role: '' }) as User;
                          return a.grading_status === 'pending_review' ? (
                            <button onClick={() => setViewingUser({ user: peserta, attemptId: a.id })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all">
                              <IkonTeks nama="⏳" />Nilai Sekarang
                            </button>
                          ) : (
                            <BtnView onClick={() => setViewingUser({ user: peserta, attemptId: a.id })}>Jawaban</BtnView>
                          );
                        })()}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!selectedSession && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3">👆</div>
              <p className="font-semibold text-slate-700">Pilih sesi quiz di atas</p>
              <p className="text-sm mt-1 text-slate-500">Hasil & jawaban peserta akan muncul setelah sesi dipilih.<br/>Tip: klik "Lihat Hasil" langsung dari kartu sesi di tab Sesi Quiz.</p>
            </div>
          </div>
        )}

        {selectedSession && loading && (
          <div className="flex justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-blue-500 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Memuat hasil...</span>
            </div>
          </div>
        )}

        {selectedSession && !loading && loadErr && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl max-w-md"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <p className="font-semibold text-rose-700">Gagal memuat hasil</p>
              <p className="text-sm mt-1 text-slate-500 wrap-break-word">{loadErr}</p>
            </div>
          </div>
        )}

        {selectedSession && !loading && !loadErr && data.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <p className="font-semibold text-slate-700">Belum ada peserta yang submit</p>
              <p className="text-sm mt-1 text-slate-500">Peserta belum mengerjakan quiz ini</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
