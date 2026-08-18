'use client';

import { useState, useEffect } from 'react';
import { supabase, User, QuizSession, fmtDate, ScoreBadge, SearchInput, BtnView, GradingStatusBadge } from './shared';
import { UserAnswerReview } from './TeamPage';

export function ReportPage({ currentUser, initialSessionId, onSessionConsumed }: {
  currentUser: User;
  /** Diisi lewat tombol "Lihat Hasil" di kartu Sesi Quiz — langsung buka sesi ini. */
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
      .then(({ data: s }: { data: QuizSession[] | null }) => setSessions(s ?? []));
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
      // Peserta diambil TERPISAH, tidak lewat embed `users(...)`. Embed hanya
      // jalan bila PostgREST mengenali relasi lc_quiz_attempts→users; kalau
      // relasi itu tidak ada, SELURUH query gagal dan error-nya sebelumnya
      // ditelan diam-diam (`data ?? []`) — halaman jadi tampak "belum ada
      // peserta" padahal datanya ada. Dua query sederhana selalu bisa
      // diandalkan, apa pun keadaan relasinya.
      const { data: attempts, error } = await supabase
        .from('lc_quiz_attempts')
        .select('*')
        .eq('quiz_session_id', selectedSession)
        .eq('is_submitted', true)
        .order('score', { ascending: false });
      if (dibatalkan) return;
      if (error) {
        setLoadErr(error.message); setData([]); setLoading(false);
        return;
      }
      const rows = attempts ?? [];
      const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: us } = await supabase
          .from('users').select('id, full_name, username, jabatan, role').in('id', userIds);
        (us ?? []).forEach((u: any) => { userMap[u.id] = u; });
      }
      if (dibatalkan) return;
      setData(rows.map((r: any) => ({ ...r, users: userMap[r.user_id] ?? null })));
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">📋 Laporan</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Hasil quiz per sesi</p>
          {/* Lebar 320px sebelumnya dipatok tanpa pengecualian — lebih lebar
              daripada layar ponsel 360px setelah dikurangi padding, jadi
              halamannya bisa digeser ke samping. */}
          <div className="mt-2">
            <select aria-label="-- Pilih Sesi --" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
              className="w-full sm:min-w-[320px] sm:w-auto border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
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
              const graded = data.filter((a: any) => a.grading_status !== 'pending_review');
              const pendingCount = data.length - graded.length;
              const cards = [
                { label: 'Peserta', value: data.length },
                { label: 'Rata-rata', value: graded.length ? (graded.reduce((s: number, a: any) => s+(a.score??0),0)/graded.length).toFixed(1) : '—' },
                { label: 'Lulus', value: graded.filter((a: any) => a.passed).length },
                { label: 'Pass Rate', value: graded.length ? `${Math.round(graded.filter((a: any) => a.passed).length/graded.length*100)}%` : '—' },
              ];
              if (session?.session_type === 'essay') cards.push({ label: '⏳ Menunggu Dinilai', value: pendingCount });
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {cards.map(c => (
                    <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                      <div className="text-2xl font-black text-slate-800">{c.value}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"
              style={{ background: '#ffffff' }}>
              <table className="w-full text-sm table-zebra" style={{ minWidth: '680px' }}>
                <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Peserta</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Waktu</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Tidak ada peserta yang cocok</td></tr>
                  )}
                  {filtered.map((a: any, i: number) => (
                    <tr key={a.id} className="stagger-item hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mx-auto ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'text-slate-400'}`}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i+1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{a.users?.full_name ?? <span className="text-slate-400 italic font-normal">(nama tidak termuat)</span>}</td>
                      <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                      <td className="px-5 py-3.5 text-center">
                        {a.grading_status === 'pending_review'
                          ? <span className="text-xs text-amber-500 font-bold">⏳ —</span>
                          : <ScoreBadge score={a.score} passing={session?.passing_grade ?? 70} />}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <GradingStatusBadge attempt={a} />
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.time_taken_sec ? `${Math.floor(a.time_taken_sec/60)}m ${a.time_taken_sec%60}s` : '—'}</td>
                      <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {/* Tombol TIDAK bergantung pada data user berhasil termuat:
                            penilaian hanya butuh user_id (UserAnswerReview mencari
                            attempt lewat id itu). Sebelumnya tombol hilang saat data
                            user kosong, sehingga essay tidak bisa dinilai sama sekali. */}
                        {(() => {
                          const peserta = (a.users ?? { id: a.user_id, full_name: a.user_id ? '(nama tidak termuat)' : '—', username: '', role: '' }) as User;
                          return a.grading_status === 'pending_review' ? (
                            <button onClick={() => setViewingUser({ user: peserta, attemptId: a.id })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all">
                              ⏳ Nilai Sekarang
                            </button>
                          ) : (
                            <BtnView onClick={() => setViewingUser({ user: peserta, attemptId: a.id })}>Jawaban</BtnView>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
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
              <span className="text-xs text-slate-400 font-medium">Memuat hasil...</span>
            </div>
          </div>
        )}

        {/* Gagal memuat ≠ belum ada peserta. Dulu keduanya tampil sama, jadi
            kegagalan query terbaca sebagai "belum ada yang mengerjakan". */}
        {selectedSession && !loading && loadErr && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl max-w-md"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3">⚠️</div>
              <p className="font-semibold text-rose-700">Gagal memuat hasil</p>
              <p className="text-sm mt-1 text-slate-500 break-words">{loadErr}</p>
            </div>
          </div>
        )}

        {selectedSession && !loading && !loadErr && data.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3">📋</div>
              <p className="font-semibold text-slate-700">Belum ada peserta yang submit</p>
              <p className="text-sm mt-1 text-slate-500">Peserta belum mengerjakan quiz ini</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
