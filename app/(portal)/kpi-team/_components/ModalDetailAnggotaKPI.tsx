'use client';

/** ModalDetailAnggotaKPI - dipecah dari app/(portal)/kpi-team/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { hitungSkorKPI, KPIMember, KPISettings } from './shared';
import { createPortal } from 'react-dom';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import React from 'react';

export interface ModalDetailAnggotaKPIProps {
  kpiMembers: KPIMember[];
  kpiSettings: KPISettings;
  kpiYear: number;
  selectedKPIMember: string | null;
  setSelectedKPIMember: React.Dispatch<React.SetStateAction<string | null>>;
}

export function ModalDetailAnggotaKPI({ kpiMembers, kpiSettings, kpiYear, selectedKPIMember, setSelectedKPIMember }: ModalDetailAnggotaKPIProps) {
  return (
    <>
      {selectedKPIMember && typeof document !== 'undefined' && (() => {
        const member = kpiMembers.find(m => m.id === selectedKPIMember);
        if (!member) return null;
        const _s = kpiSettings;
        const { lcFailed, tickScore, bastScore, lcScore, rndScore, finalKPI, kpiDasar, faktorLC, potonganLC } = hitungSkorKPI(member, _s);
        const rekapLC = member.lcTahunan;
        const noData    = member.ticketsHandled === 0 && member.lcAttempts === 0 && member.techNotesApproved === 0;
        const c         = noData ? '#94a3b8' : finalKPI >= 85 ? '#10b981' : finalKPI >= 70 ? '#3b82f6' : finalKPI >= 50 ? '#f59e0b' : '#ef4444';

        return createPortal(
          <div role="dialog" aria-modal="true" aria-label="Detail KPI anggota" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedKPIMember(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto" style={{ maxHeight: '100%', scrollbarWidth: 'thin' }}>

              {/* Modal header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg,${c},${c}99)` }}>
                  {member.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm truncate">{member.name}</div>
                  <div className="text-xs text-slate-500">{member.jabatan} · {member.team_type}</div>
                </div>
                <div className="flex flex-col items-end mr-1 flex-shrink-0">
                  <div className="text-lg sm:text-2xl font-black" style={{ color: c }}>{noData ? '—' : `${finalKPI}%`}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KPI Score</div>
                </div>
                <button aria-label="Tutup" onClick={() => setSelectedKPIMember(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Score breakdown cards */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Ticketing',      raw: Math.round(tickScore * 100), pct: Math.round(tickScore * _s.ticketOverdueWeight * 100), w: Math.round(_s.ticketOverdueWeight * 100), color: '#ef4444', icon: '🎫', bg: '#fef2f2', border: '#ef444440' },
                    { label: 'BAST & Demo',    raw: Math.round(bastScore * 100),  pct: Math.round(bastScore * _s.bastWeight * 100),          w: Math.round(_s.bastWeight * 100),          color: '#f59e0b', icon: '⭐', bg: '#fffbeb', border: '#f59e0b40' },
                    { label: 'Learning Center',raw: Math.round(lcScore * 100),    pct: Math.round(lcScore * _s.lcWeight * 100),              w: Math.round(_s.lcWeight * 100),            color: '#6366f1', icon: '🎓', bg: '#f5f3ff', border: '#6366f140' },
                    { label: 'R&D Tech Note',  raw: Math.round(rndScore * 100),   pct: Math.round(rndScore * _s.rndWeight * 100),            w: Math.round(_s.rndWeight * 100),           color: '#ec4899', icon: '📝', bg: '#fdf4ff', border: '#ec489940' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border p-2 text-center" style={{ background: k.bg, borderColor: k.border }}>
                      <div className="text-xs mb-0.5"><Ikon nama={k.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight mb-1">{k.label}</div>
                      <div className="text-lg font-black leading-none" style={{ color: k.color }}>{k.pct}%</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">bobot {k.w}%</div>
                    </div>
                  ))}
                </div>

                {/* Potongan prorata Learning Center setahun - lib/kpi-lc-tahunan.ts */}
                {rekapLC && rekapLC.wajib > 0 && (
                  <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                    style={potonganLC > 0 ? { background: '#fef2f2', borderColor: '#fecaca' } : { background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: potonganLC > 0 ? '#b91c1c' : '#15803d' }}>
                        <IkonTeks nama="🎓" />Kelulusan Learning Center {kpiYear}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Lulus <b>{rekapLC.lulus}</b> dari <b>{rekapLC.wajib}</b> sesi
                        {rekapLC.gagal > 0 && <> · {rekapLC.gagal} tidak lulus</>}
                        {rekapLC.tidakIkut > 0 && <> · {rekapLC.tidakIkut} tidak dikerjakan</>}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-slate-500">KPI dasar <b className="text-slate-700">{kpiDasar}%</b> × {Math.round(faktorLC * 100)}%</div>
                      <div className="font-black" style={{ color: potonganLC > 0 ? '#b91c1c' : '#15803d' }}>
                        {potonganLC > 0 ? `−${potonganLC} poin` : 'Tanpa potongan'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto platform data */}
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2"><IkonTeks nama="✅" />Data Platform (Otomatis)</div>
                  <div className="grid grid-cols-3 gap-2">

                    {/* Ticketing */}
                    <div className="rounded-xl border p-3" style={{ borderColor: '#ef444440', background: '#fef2f2' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider"><IkonTeks nama="🎫" />Ticketing</div>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: tickScore >= 1 ? '#d1fae5' : '#fee2e2', color: tickScore >= 1 ? '#065f46' : '#991b1b' }}>
                          {Math.round(tickScore * _s.ticketOverdueWeight * 100)}/{Math.round(_s.ticketOverdueWeight * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="flex justify-between"><span>Handled</span><b className="text-slate-800">{member.ticketsHandled}</b></div>
                        <div className="flex justify-between"><span>Solved</span><b className="text-emerald-700">{member.ticketsSolved}</b></div>
                        <div className="flex justify-between"><span>Overdue</span><b className={member.ticketsOverdue > 0 ? 'text-red-600' : 'text-emerald-700'}>{member.ticketsOverdue}</b></div>
                        <div className="flex justify-between"><span>Avg Response</span><b className={member.ticketAvgResponseHours > 24 ? 'text-red-600' : 'text-emerald-700'}>{member.ticketAvgResponseHours > 0 ? `${member.ticketAvgResponseHours}j` : '—'}</b></div>
                        {member.ticketsOverdue === 0
                          ? <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Tidak ada overdue</div>
                          : <div className="text-[11px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {member.ticketsOverdue} ticket overdue</div>}
                      </div>
                    </div>

                    {/* BAST & Demo */}
                    <div className="rounded-xl border p-3" style={{ borderColor: '#f59e0b40', background: '#fffbeb' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider"><IkonTeks nama="⭐" />BAST &amp; Demo</div>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: bastScore >= 1 ? '#d1fae5' : '#fee2e2', color: bastScore >= 1 ? '#065f46' : '#991b1b' }}>
                          {Math.round(bastScore * _s.bastWeight * 100)}/{Math.round(_s.bastWeight * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="text-[10px] text-slate-500 mb-1">Sumber: Form Review BAST &amp; Demo</div>
                        <div className="flex justify-between"><span>Total Review</span><b className="text-slate-800">{member.formReviewTotal}</b></div>
                        <div className="flex justify-between"><span>Komplain (★1-2)</span><b className={member.formReviewLowRating > 0 ? 'text-red-600' : 'text-emerald-700'}>{member.formReviewLowRating}x</b></div>
                        {member.formReviewTotal === 0
                          ? <div className="text-[11px] text-slate-500 font-semibold bg-slate-50 rounded-lg px-2 py-1"><IkonTeks nama="⏳" />Belum ada review</div>
                          : member.formReviewLowRating === 0
                            ? <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Tidak ada komplain dari {member.formReviewTotal} review</div>
                            : <div className="text-[11px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {member.formReviewLowRating}x komplain dari {member.formReviewTotal} review</div>}
                      </div>
                    </div>

                    {/* Learning Center */}
                    <div className="rounded-xl border p-3" style={{ borderColor: '#6366f140', background: '#f5f3ff' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-bold text-violet-600 uppercase tracking-wider"><IkonTeks nama="🎓" />Learning Center</div>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: lcScore >= 1 ? '#d1fae5' : '#fee2e2', color: lcScore >= 1 ? '#065f46' : '#991b1b' }}>
                          {Math.round(lcScore * _s.lcWeight * 100)}/{Math.round(_s.lcWeight * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="text-[10px] text-slate-500 mb-1">Nilai penuh jika tidak ada &lt;{_s.lcMinScore}</div>
                        <div className="flex justify-between"><span>Total Attempt</span><b className="text-slate-800">{member.lcAttempts}</b></div>
                        <div className="flex justify-between"><span>Avg Score</span><b className={member.lcAvgScore < _s.lcMinScore && member.lcAvgScore > 0 ? 'text-red-600' : 'text-emerald-700'}>{member.lcAvgScore || '—'}</b></div>
                        <div className="flex justify-between"><span>Lulus</span><b className="text-emerald-700">{member.lcPassed}</b></div>
                        <div className="flex justify-between"><span>Nilai &lt;{_s.lcMinScore}</span><b className={lcFailed > 0 ? 'text-red-600' : 'text-emerald-700'}>{lcFailed}x</b></div>
                        {lcFailed > 0
                          ? <div className="text-[11px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {lcFailed}x nilai &lt;{_s.lcMinScore}</div>
                          : member.lcAttempts > 0
                            ? <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Semua nilai ≥{_s.lcMinScore}</div>
                            : null}
                      </div>
                    </div>
                  </div>

                  {/* Reminder & Piket */}
                  <div className="mt-2 bg-slate-50 rounded-xl border border-slate-100 p-3 text-[11px] text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
                    <span><IkonTeks nama="📅" />Reminder: <b className="text-slate-800">{member.remindersDone}</b>/{member.remindersAssigned} done</span>
                    <span><IkonTeks nama="🏪" />Piket: <b className="text-slate-800">{member.piketFilled}</b> hari bertugas</span>
                    <span><IkonTeks nama="⏱" />Avg response: <b className={member.ticketAvgResponseHours > 24 ? 'text-red-600 text-slate-800' : 'text-slate-800'}>{member.ticketAvgResponseHours > 0 ? `${member.ticketAvgResponseHours} jam` : '—'}</b></span>
                  </div>
                </div>

                {/* R&D Tech Note */}
                <div className="rounded-xl border p-3" style={{ borderColor: '#ec489940', background: '#fdf4ff' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-bold text-pink-600 uppercase tracking-wider"><IkonTeks nama="📝" />R&amp;D Tech Note (Otomatis dari Platform)</div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: rndScore >= 1 ? '#d1fae5' : '#fee2e2', color: rndScore >= 1 ? '#065f46' : '#991b1b' }}>
                      {Math.round(rndScore * _s.rndWeight * 100)}/{Math.round(_s.rndWeight * 100)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">
                    Target: <b className="text-slate-700">{_s.rndTarget} Tech Note approved</b> per tahun
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg sm:text-2xl font-black" style={{ color: rndScore >= 1 ? '#059669' : '#dc2626' }}>{member.techNotesApproved}</span>
                    <span className="text-[11px] text-slate-500 font-medium">/ {_s.rndTarget}</span>
                    <div className="h-2 flex-1 rounded-full bg-pink-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, rndScore * 100)}%`, background: rndScore >= 1 ? '#10b981' : '#f472b6' }} />
                    </div>
                  </div>
                  {member.techNotesApproved === 0
                    ? <div className="text-[11px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1.5"><IkonTeks nama="⚠" />Belum ada Tech Note yang diapprove tahun ini</div>
                    : member.techNotesApproved >= _s.rndTarget
                      ? <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-2 py-1.5"><IkonTeks nama="✅" />KKM Tech Note terpenuhi ({member.techNotesApproved}/{_s.rndTarget})</div>
                      : <div className="text-[11px] text-amber-700 font-semibold bg-amber-50 rounded-lg px-2 py-1.5"><IkonTeks nama="⏳" />Kurang {_s.rndTarget - member.techNotesApproved} Tech Note lagi</div>}
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
