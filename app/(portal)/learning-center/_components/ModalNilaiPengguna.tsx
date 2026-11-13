'use client';

import React from 'react';
import { ModalPortal, DonutChart } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import type { PercobaanPengguna } from './tipe-dasbor';

export function ModalNilaiPengguna({ selectedUser, setSelectedUser, userAttempts, loadingUser }: {
  selectedUser: { uid: string; name: string } | null;
  setSelectedUser: (v: null) => void;
  userAttempts: PercobaanPengguna[];
  loadingUser: boolean;
}) {
  if (!selectedUser) return null;
  return (
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
                        ? (userAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / userAttempts.length).toFixed(1) : '—',
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
                  {userAttempts.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">Belum ada quiz yang diselesaikan</p>}
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
                          <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.materi_name ?? ''}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                              {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                            </span>
                            {a.time_taken_sec != null && <span className="text-xs text-slate-500"><Ikon nama="⏱" ukuran="1em" className="inline-block align-[-0.12em]" /> {Math.floor(a.time_taken_sec / 60)}m {a.time_taken_sec % 60}s</span>}
                            {tabSw > 0 && <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {tabSw}× tab</span>}
                            {isFast && <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full"><IkonTeks nama="🚨" />Submit terlalu cepat</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="text-xs font-semibold text-slate-600">{a.total_correct ?? '?'}/{a.total_questions ?? '?'} benar</p>
                          <p className="text-[11px] text-slate-500">KKM {passing}</p>
                          {a.submitted_at && <p className="text-[11px] text-slate-500">{new Date(a.submitted_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
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
  );
}
