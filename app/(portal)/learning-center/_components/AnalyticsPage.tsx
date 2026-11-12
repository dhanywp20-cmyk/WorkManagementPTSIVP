'use client';
import { TeamSwitch, TEAM_FILTER_CONFIG } from './team-filter';
import { SearchInput } from './shared';
import { ModalPortal, DonutChart } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { useAnalyticsLC } from './useAnalyticsLC';
import { TabelDivisiLC } from './TabelDivisiLC';
import { KartuSesiKuis } from './KartuSesiKuis';

export function AnalyticsPage() {
  const {
    activeTeam, setActiveTeam, search, setSearch, sessionStats, nationalAvg, divisionStats, divisionFilter,
    setDivisionFilter, filteredUsers, setSelectedUser, loading, selectedUser, loadingUser, userAttempts,
  } = useAnalyticsLC();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight"><IkonTeks nama="📈" />Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Performa team & statistik quiz</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <TeamSwitch active={activeTeam} onChange={setActiveTeam} />
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama..." />
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-10">

        <KartuSesiKuis sessionStats={sessionStats} />

        <section>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <h3 className="text-[11px] font-bold uppercase tracking-widest inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-xs backdrop-blur-xs">
              <IkonTeks nama="🏆" />Top Performers — {TEAM_FILTER_CONFIG[activeTeam].label}
            </h3>
            <div className="flex items-center gap-2">
              {nationalAvg !== null && (
                <span className="text-[11px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
                  <IkonTeks nama="🌏" />Rata-rata Nasional (semua divisi): <span className="text-slate-800">{nationalAvg.toFixed(1)}</span>
                </span>
              )}
              {divisionStats.length > 0 && (
                <select aria-label="Filter divisi" value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 outline-hidden focus:border-indigo-400 bg-white font-semibold text-slate-600">
                  <option value="">Semua Divisi</option>
                  {divisionStats.map(d => <option key={d.div} value={d.div}>{d.div}</option>)}
                </select>
              )}
            </div>
          </div>
          <p className="inline-block text-xs text-slate-500 mb-4 bg-white/90 rounded-full px-3 py-1 shadow-xs">
            Klik nama untuk melihat detail nilai & aktivitas per quiz{divisionFilter && <> · Menampilkan divisi <strong>{divisionFilter}</strong></>}
          </p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto">
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
                    <td className="px-5 py-3.5 text-center text-sm font-black text-slate-500">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{u.name}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-indigo-400 font-semibold"><IkonTeks nama="👁" />detail</span>
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
                          <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {u.flags}×
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                      {loading ? 'Memuat data...' : (search || divisionFilter) ? 'Tidak ada hasil' : `Belum ada data untuk ${TEAM_FILTER_CONFIG[activeTeam].label}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <TabelDivisiLC divisionStats={divisionStats} nationalAvg={nationalAvg} />
      </div>

      {selectedUser && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-1000 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-kartu shadow-modal w-full max-w-2xl max-h-full flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="font-bold text-slate-800 text-lg leading-tight">{selectedUser.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Riwayat semua quiz yang diselesaikan</p>
              </div>
              <button aria-label="Tutup" onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all text-lg font-bold">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {loadingUser ? (
                <div className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Memuat data...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Quiz', value: userAttempts.length, color: 'text-slate-800' },
                      {
                        label: 'Avg Score',
                        value: userAttempts.length
                          ? (userAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / userAttempts.length).toFixed(1)
                          : '—',
                        color: (() => {
                          if (!userAttempts.length) return 'text-slate-500';
                          const avg = userAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / userAttempts.length;
                          return avg >= 80 ? 'text-emerald-700' : avg >= 70 ? 'text-amber-700' : 'text-rose-600';
                        })(),
                      },
                      { label: 'Lulus', value: userAttempts.filter(a => a.passed).length, color: 'text-emerald-700' },
                      {
                        label: 'Pindah Tab',
                        value: userAttempts.reduce((s, a) => s + (a.tab_switches ?? 0), 0),
                        color: userAttempts.reduce((s, a) => s + (a.tab_switches ?? 0), 0) > 0 ? 'text-amber-700' : 'text-slate-500',
                      },
                    ].map(c => (
                      <div key={c.label} className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
                        <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{c.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {userAttempts.length === 0 && (
                      <p className="text-center text-slate-500 py-8 text-sm">Belum ada quiz yang diselesaikan</p>
                    )}
                    {userAttempts.map(a => {
                      const score = a.score ?? 0;
                      const passing = a.lc_quiz_sessions?.passing_grade ?? 70;
                      const tabSw = a.tab_switches ?? 0;
                      return (
                        <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-xs transition-all">
                          <DonutChart
                            segments={[
                              { value: score, color: score >= passing ? (score >= 80 ? '#10b981' : '#f59e0b') : '#f43f5e' },
                              { value: Math.max(100 - score, 0), color: '#f1f5f9' },
                            ]}
                            size={56} strokeWidth={8}
                            label={score.toFixed(0)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {a.lc_quiz_sessions?.session_name ?? '—'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.materi_name ?? ''}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                                {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                              </span>
                              {a.time_taken_sec != null && (
                                <span className="text-xs text-slate-500"><Ikon nama="⏱" ukuran="1em" className="inline-block align-[-0.12em]" /> {Math.floor(a.time_taken_sec / 60)}m {a.time_taken_sec % 60}s</span>
                              )}
                              {tabSw > 0 && (
                                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {tabSw}× pindah tab
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-600">
                              {a.total_correct ?? '?'}/{a.total_questions ?? '?'} benar
                            </p>
                            <p className="text-[11px] text-slate-500">KKM {passing}</p>
                            {a.submitted_at && (
                              <p className="text-[11px] text-slate-500">
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
      </ModalPortal>
      )}
    </div>
  );
}
