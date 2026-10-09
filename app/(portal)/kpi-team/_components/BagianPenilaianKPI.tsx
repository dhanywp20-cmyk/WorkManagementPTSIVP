'use client';

/** BagianPenilaianKPI - dipecah dari app/(portal)/kpi-team/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { lingkupSaya } from '@/lib/kelompok';
import { KPIUser, KPIMember, KPISettings, warnaTim } from './shared';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import React from 'react';

export interface BagianPenilaianKPIProps {
  calcKPI: (m: KPIMember) => number;
  currentUser: KPIUser | null;
  fetchKPIMembers: () => Promise<void>;
  filterTeam: string;
  kpiFiltered: KPIMember[];
  kpiLoading: boolean;
  kpiPeriodLabel: string;
  kpiPeriodLen: "6m" | "1y";
  kpiScoreColor: (score: number, noData: boolean) => "#64748b" | "#047857" | "#1d4ed8" | "#b45309" | "#dc2626";
  kpiScoreLabel: (score: number, noData: boolean) => "Belum Ada Data" | "Excellent" | "Good" | "Fair" | "Needs Work";
  kpiSettings: KPISettings;
  kpiStartMonth: number;
  kpiYear: number;
  setKpiPeriodLen: React.Dispatch<React.SetStateAction<"6m" | "1y">>;
  setKpiStartMonth: React.Dispatch<React.SetStateAction<number>>;
  setKpiYear: React.Dispatch<React.SetStateAction<number>>;
  setSelectedKPIMember: React.Dispatch<React.SetStateAction<string | null>>;
}

export function BagianPenilaianKPI({ calcKPI, currentUser, fetchKPIMembers, filterTeam, kpiFiltered, kpiLoading, kpiPeriodLabel, kpiPeriodLen, kpiScoreColor, kpiScoreLabel, kpiSettings, kpiStartMonth, kpiYear, setKpiPeriodLen, setKpiStartMonth, setKpiYear, setSelectedKPIMember }: BagianPenilaianKPIProps) {
  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.7)' }}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500"><IkonTeks nama="🏅" />Penilaian KPI</span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg text-blue-700" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {kpiPeriodLabel}
            </span>
            {kpiLoading && <div className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin flex-shrink-0" />}
          </div>
          {/* KPI period controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['6m','1y'] as const).map(p => (
                <button key={p} onClick={() => { setKpiPeriodLen(p); if (p==='1y') setKpiStartMonth(1); }}
                  className="px-2.5 py-1 text-[11px] font-bold transition-all"
                  style={{ background: kpiPeriodLen===p ? '#0369a1' : '#fff', color: kpiPeriodLen===p ? '#fff' : '#64748b' }}>
                  {p==='6m' ? '6 Bln' : '1 Thn'}
                </button>
              ))}
            </div>
            {kpiPeriodLen === '6m' && (
              <select value={kpiStartMonth} onChange={e => setKpiStartMonth(Number(e.target.value))} aria-label="Periode enam bulan"
                className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
                {[{v:1,l:'Jan–Jun'},{v:2,l:'Feb–Jul'},{v:3,l:'Mar–Agt'},{v:4,l:'Apr–Sep'},{v:5,l:'Mei–Okt'},{v:6,l:'Jun–Nov'},{v:7,l:'Jul–Des'}].map(o=>(
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            )}
            <select value={kpiYear} onChange={e => setKpiYear(Number(e.target.value))} aria-label="Tahun"
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
              {[2024,2025,2026,2027].map(y=>(<option key={y} value={y}>{y}</option>))}
            </select>
            <button onClick={() => fetchKPIMembers()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 transition-all">
              <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Refresh
            </button>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg text-slate-500" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Ikon nama="🎫" ukuran="1em" className="inline-block align-[-0.12em]" />{Math.round(kpiSettings.ticketOverdueWeight*100)}% ⭐{Math.round(kpiSettings.bastWeight*100)}% 🎓{Math.round(kpiSettings.lcWeight*100)}% 📝{Math.round(kpiSettings.rndWeight*100)}%
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl text-[11px] text-sky-700 leading-relaxed"
          style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <b><IkonTeks nama="📌" />Keterangan:</b> Data ✅ otomatis dari platform.&nbsp;
          <b><IkonTeks nama="🎫" />Ticketing</b> (nilai penuh jika 0 overdue) · <b><IkonTeks nama="⭐" />BAST &amp; Demo</b> (nilai penuh jika tidak ada bintang &lt;3) ·{' '}
          <b><IkonTeks nama="🎓" />LC</b> (nilai penuh jika tidak ada nilai &lt;{kpiSettings.lcMinScore}) ·{' '}
          <b><IkonTeks nama="📝" />R&D</b> (nilai penuh jika ≥{kpiSettings.rndTarget} tech note/tahun). Klik kartu untuk detail.
        </div>

        {/* Member chips */}
        {kpiLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
          </div>
        ) : kpiFiltered.length === 0 ? (
          <p className="text-center py-10 text-slate-500 text-sm">Tidak ada anggota dengan KPI aktif. Aktifkan kpi_enabled di user management.</p>
        ) : (() => {
          // Urutan & isinya mengikuti lingkup akun ini - lihat catatan di
          // pemuatan anggota. Kelompok di luar lingkup tidak pernah sampai
          // ke kpiFiltered, jadi baris ini hanya menentukan urutan tampil.
          const teams = lingkupSaya(currentUser?.id);
          const rows = filterTeam === 'all'
            ? teams.map(tt => ({ tt, ms: kpiFiltered.filter(m => m.team_type === tt) })).filter(r => r.ms.length > 0)
            : [{ tt: filterTeam, ms: kpiFiltered }];

          return (
            <div className="p-4 space-y-3">
              {rows.map(({ tt, ms }) => {
                const col = warnaTim(tt);
                const abbr = tt.replace('Team PTS ', '');
                const scored = ms.filter(m => !(m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0));
                const avg = scored.length ? Math.round(scored.reduce((s, m) => s + calcKPI(m), 0) / scored.length) : null;
                const avgC = avg == null ? '#94a3b8' : avg >= 85 ? '#10b981' : avg >= 70 ? '#3b82f6' : avg >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={tt} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100" style={{ background: `${col}08` }}>
                      <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[11px] font-black flex-shrink-0" style={{ background: col }}>{abbr[0]}</div>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{tt}</span>
                      <span className="text-[11px] text-slate-500">{ms.length} anggota</span>
                      {avg !== null && <span className="ml-auto text-sm font-black" style={{ color: avgC }}>avg {avg}%</span>}
                    </div>
                    <div className="flex gap-2 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                      {ms.map(m => {
                        const score = calcKPI(m);
                        const noData = m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0;
                        const c = kpiScoreColor(score, noData);
                        const lbl = kpiScoreLabel(score, noData);
                        const sparkMax = Math.max(...m.monthlyTickets, 1);
                        const W = 72, H = 18;
                        const pts = m.monthlyTickets.map((v, i) => `${(i / 11) * W},${H - (v / sparkMax) * H}`).join(' ');
                        const lcFailed = m.lcScores.filter(sc => sc < kpiSettings.lcMinScore).length;
                        const alerts: string[] = [];
                        if (m.ticketsHandled === 0) alerts.push('🎫0');
                        if (lcFailed > 0) alerts.push(`📚${lcFailed}×`);
                        if (m.formReviewLowRating > 0) alerts.push(`⭐${m.formReviewLowRating}×`);
                        if (m.ticketAvgResponseHours > 24) alerts.push(`⏱${m.ticketAvgResponseHours}j`);
                        return (
                          <div key={m.id} {...bisaDiklik(() => setSelectedKPIMember(m.id))}
                            className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border cursor-pointer hover:shadow-md transition-all"
                            style={{ background: noData ? '#f8fafc' : `${c}08`, borderColor: noData ? '#e2e8f0' : `${c}40`, minWidth: 88, maxWidth: 104 }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm flex-shrink-0"
                              style={{ background: `linear-gradient(135deg,${c},${c}88)` }}>
                              {m.name.charAt(0)}
                            </div>
                            <div className="text-[11px] font-bold text-slate-700 text-center leading-tight w-full truncate" title={m.name}>
                              {m.name.split(' ')[0]}
                            </div>
                            <div className="text-sm font-black leading-none" style={{ color: c }}>
                              {noData ? '—' : `${score}%`}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</div>
                            {m.monthlyTickets.some(v => v > 0) && (
                              <svg aria-hidden="true" focusable="false" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                                <polyline points={pts} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
                                <circle cx={W} cy={H - (m.monthlyTickets[11] / sparkMax) * H} r={2.5} fill={c} />
                              </svg>
                            )}
                            {alerts.length > 0 && (
                              <div className="flex gap-0.5 flex-wrap justify-center">
                                {alerts.map((a, i) => (
                                  <span key={i} className="text-[10px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 leading-none">{a}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </>
  );
}
