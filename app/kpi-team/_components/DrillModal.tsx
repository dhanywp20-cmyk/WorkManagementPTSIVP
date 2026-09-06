'use client';

import React from 'react';

import * as XLSX from 'xlsx-js-style';

import { MonthBarChart, TrendBadge, ModalPortal } from '@/components/shared';

import { KPIMember, PeriodKey, warnaTim, KPI_COLOR, progressColor } from './shared';

/**
 * Popup rincian satu metrik KPI, berikut dua komponen kecil yang hanya dipakai di dalamnya.
 */

// Drill-down Modal

export function DrillModal({ member, onClose, period, onViewBreakdown }: { member: KPIMember; onClose: () => void; period: PeriodKey; onViewBreakdown?: () => void }) {
  const solveRate = member.ticketsHandled > 0 ? Math.round((member.ticketsSolved / member.ticketsHandled) * 100) : 0;
  const remRate   = member.remindersAssigned > 0 ? Math.round((member.remindersDone / member.remindersAssigned) * 100) : 0;
  const teamColor = warnaTim(member.team_type);

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ maxHeight: '100%' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 relative"
          style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}cc)` }}>
          <button aria-label="Tutup" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black text-white"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              {member.name.charAt(0)}
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Nama</p>
              <div className="text-white font-black text-sm leading-tight">{member.name}</div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mt-1.5 mb-0.5">Tim · Jabatan · Periode</p>
              <div className="text-white/70 text-[10px]">{member.team_type.replace('Team ','')} · {member.jabatan} · {period}</div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">

          {/* Ticket Stats */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">🎫 Ticketing</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Ditangani', value: member.ticketsHandled, c: teamColor },
                { label: 'Solved',    value: member.ticketsSolved,  c: '#10b981' },
                { label: 'Overdue',   value: member.ticketsOverdue, c: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center p-2.5 rounded-xl"
                  style={{ background: `${s.c}12` }}>
                  <span className="text-2xl font-black leading-none" style={{ color: s.c }}>{s.value}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">Solve Rate</span>
                  <span className="font-bold" style={{ color: progressColor(solveRate) }}>{solveRate}%</span>
                </div>
                <ProgressBar value={member.ticketsSolved} max={member.ticketsHandled} showPct={false} h={7} />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Rata-rata resolusi</span>
                <span className="font-semibold text-slate-600">
                  {member.avgResolutionDays === 0 ? '—' : `${member.avgResolutionDays} hari`}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Avg first response</span>
                <span className="font-semibold text-slate-600">
                  {member.ticketAvgResponseHours === 0 ? '—' : `${member.ticketAvgResponseHours} jam`}
                </span>
              </div>
            </div>
          </section>

          {/* Reminder */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">📅 Reminder Schedule</p>
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-500">Done Rate</span>
                <span className="font-bold" style={{ color: progressColor(remRate) }}>{remRate}%</span>
              </div>
              <ProgressBar value={member.remindersDone} max={member.remindersAssigned} showPct={false} h={7} />
              <div className="flex justify-between text-[10px] mt-1.5">
                <span className="text-slate-400">Diselesaikan</span>
                <span className="font-semibold text-slate-600">{member.remindersDone} / {member.remindersAssigned}</span>
              </div>
            </div>
          </section>

          {/* Learning Center */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">📚 Learning Center</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Quiz Attempts', value: member.lcAttempts,  c: '#6366f1' },
                { label: 'Passed',        value: member.lcPassed,    c: '#10b981' },
                { label: 'Avg Score',     value: member.lcAvgScore === 0 ? '—' : member.lcAvgScore, c: teamColor },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center p-2.5 rounded-xl"
                  style={{ background: `${s.c}12` }}>
                  <span className="text-2xl font-black leading-none" style={{ color: s.c }}>{s.value}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Piket */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">🏪 Piket Showroom</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black" style={{ color: '#0d9488' }}>{member.piketFilled}</span>
              <span className="text-[11px] text-slate-500">hari piket pada periode ini</span>
            </div>
          </section>

          {/* Monthly Trend */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">📈 Trend Ticket per Bulan</p>
            <MonthBarChart values={member.monthlyTickets} color={teamColor} />
          </section>

          {/* M14 (docs/UX-WORKFLOW-AUDIT.md): modal ini (dibuka dari klik baris
              tabel - jalur paling wajar) dulu cuma angka mentah tanpa konteks
              "apa yang harus diperbaiki". Breakdown per-bobot yang actionable
              sudah ada di modal lain (chip kecil "Penilaian KPI") - dihubungkan
              di sini alih-alih dibangun ulang. */}
          {onViewBreakdown && (
            <button onClick={onViewBreakdown}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 flex items-center justify-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}cc)` }}>
              📊 Lihat Breakdown KPI &amp; Yang Perlu Diperbaiki →
            </button>
          )}

        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

export function SummaryCard({ icon, label, value, sub, color, trend, lowerIsBetter }: {
  icon: string; label: string; value: string | number; sub?: string;
  color: string; trend?: number; lowerIsBetter?: boolean;
}) {
  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-[0.08]"
        style={{ background: color, transform: 'translate(30%,-30%)' }} />
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-widest truncate" style={{ color: 'rgba(0,0,0,0.38)' }}>{label}</span>
      </div>
      <div className="text-2xl font-black leading-none tracking-tight" style={{ color }}>{value}</div>
      <div className="flex items-center justify-between gap-1 min-h-[14px]">
        {sub && <span className="text-[10px] text-slate-400 truncate">{sub}</span>}
        {trend !== undefined && <TrendBadge delta={trend} lowerIsBetter={lowerIsBetter} />}
      </div>
    </div>
  );
}

// Sub-components

export function ProgressBar({ value, max, showPct = true, h = 6 }: { value: number; max: number; showPct?: boolean; h?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = progressColor(pct);
  return (
    <div className="flex items-center gap-1.5 w-full min-w-0">
      <div className="flex-1 rounded-full overflow-hidden flex-shrink-0" style={{ height: h, background: '#f1f5f9', minWidth: 40 }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showPct && (
        <span className="text-[10px] font-bold w-7 text-right flex-shrink-0" style={{ color }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
