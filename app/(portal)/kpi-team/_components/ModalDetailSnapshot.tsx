'use client';

/** ModalDetailSnapshot - dipecah dari app/(portal)/kpi-team/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { KPIPeriodSnapshot, warnaTim } from './shared';
import { createPortal } from 'react-dom';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import React from 'react';

export interface ModalDetailSnapshotProps {
  kpiSnapshots: KPIPeriodSnapshot[];
  selectedSnapMember: string | null;
  setSelectedSnapMember: React.Dispatch<React.SetStateAction<string | null>>;
}

export function ModalDetailSnapshot({ kpiSnapshots, selectedSnapMember, setSelectedSnapMember }: ModalDetailSnapshotProps) {
  return (
    <>
      {selectedSnapMember && typeof document !== 'undefined' && (() => {
        const [memberId, snapId] = selectedSnapMember.split('__');
        const snap = kpiSnapshots.find(s => s.id === snapId);
        const m    = snap?.members_json.find(x => x.id === memberId);
        if (!snap || !m) return null;
        const c   = m.finalKPI >= 85 ? '#10b981' : m.finalKPI >= 70 ? '#3b82f6' : m.finalKPI >= 50 ? '#f59e0b' : '#ef4444';
        const lbl = m.finalKPI >= 85 ? 'Excellent' : m.finalKPI >= 70 ? 'Good' : m.finalKPI >= 50 ? 'Fair' : 'Needs Work';
        const tc  = warnaTim(m.team_type);
        const sc  = (v: number) => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';
        return createPortal(
          <div role="dialog" aria-modal="true" aria-label="Detail anggota" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedSnapMember(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto" style={{ maxHeight: '100%' }}>
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg,${tc},${tc}cc)` }}>{m.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm truncate">{m.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    {m.jabatan} · {m.team_type}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}><IkonTeks nama="🔒" />Snapshot</span>
                  </div>
                </div>
                <div className="flex flex-col items-end mr-1 flex-shrink-0">
                  <div className="text-lg sm:text-2xl font-black" style={{ color: c }}>{m.finalKPI}%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</div>
                </div>
                <button aria-label="Tutup" onClick={() => setSelectedSnapMember(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-[11px] text-slate-500 text-center italic"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {snap.period_label} — Data dibekukan pada {new Date(snap.created_at).toLocaleDateString('id-ID')}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Ticketing', val: m.tickScore, color: '#ef4444', icon: '🎫', bg: '#fef2f2' },
                    { label: 'BAST',      val: m.bastScore,  color: '#f59e0b', icon: '⭐', bg: '#fffbeb' },
                    { label: 'LC',        val: m.lcScore,    color: '#6366f1', icon: '🎓', bg: '#f5f3ff' },
                    { label: 'R&D',       val: m.rndScore,   color: '#ec4899', icon: '📝', bg: '#fdf4ff' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border p-2 text-center" style={{ background: k.bg, borderColor: `${k.color}40` }}>
                      <div className="text-xs mb-0.5"><Ikon nama={k.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight mb-1">{k.label}</div>
                      <div className="text-lg font-black" style={{ color: sc(k.val) }}>{k.val}%</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between"><span>Tickets Handled</span><b className="text-slate-800">{m.ticketsHandled}</b></div>
                  <div className="flex justify-between"><span>Tickets Overdue</span><b className={m.ticketsOverdue > 0 ? 'text-red-600' : 'text-emerald-700'}>{m.ticketsOverdue}</b></div>
                  <div className="flex justify-between"><span>LC Attempts</span><b className="text-slate-800">{m.lcAttempts}</b></div>
                  <div className="flex justify-between"><span>LC Passed</span><b className="text-emerald-700">{m.lcPassed}</b></div>
                  <div className="flex justify-between"><span>Form Reviews</span><b className="text-slate-800">{m.formReviewTotal}</b></div>
                  <div className="flex justify-between"><span>Review Komplain</span><b className={m.formReviewLowRating > 0 ? 'text-red-600' : 'text-emerald-700'}>{m.formReviewLowRating}x</b></div>
                  <div className="flex justify-between"><span>Tech Notes Approved</span><b className="text-slate-800">{m.techNotesApproved}</b></div>
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
