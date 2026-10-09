'use client';

/** TabelKinerjaHandler - dipecah dari app/(portal)/kpi-team/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import { MobileListCard, MobileCardBadge, MiniSpark, ListEmptyState } from '@/components/shared';
import { KPIMember, PeriodKey, SortKey, warnaTim } from './shared';
import { ProgressBar } from './DrillModal';
import React from 'react';

export interface TabelKinerjaHandlerProps {
  SortIcon: ({ k }: { k: SortKey; }) => React.JSX.Element;
  filterTeam: string;
  handleSort: (k: SortKey) => void;
  loading: boolean;
  period: PeriodKey;
  searchQ: string;
  setDrillMember: React.Dispatch<React.SetStateAction<KPIMember | null>>;
  setFilterTeam: React.Dispatch<React.SetStateAction<string>>;
  setSearchQ: React.Dispatch<React.SetStateAction<string>>;
  sortedMembers: KPIMember[];
}

export function TabelKinerjaHandler({ SortIcon, filterTeam, handleSort, loading, period, searchQ, setDrillMember, setFilterTeam, setSearchQ, sortedMembers }: TabelKinerjaHandlerProps) {
  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.7)' }}>
        {/* Table header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500"><IkonTeks nama="👥" />Handler Performance</span>
            {!loading && (
              <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                {sortedMembers.length} anggota
              </span>
            )}
          </div>
          {/* Search */}
          <input aria-label="Cari nama..."
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Cari nama..."
            className="text-[11px] border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-100 w-40"
          />
        </div>

        {/* ── MOBILE: kartu ringkas KPI per anggota (tap utk detail) ── */}
        <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
          {!loading && sortedMembers.length === 0 && (
            <ListEmptyState
              adaFilterAktif={filterTeam !== 'all' || searchQ.trim() !== ''}
              onReset={() => { setFilterTeam('all'); setSearchQ(''); }}
              icon="📈"
              judulKosong={`Belum ada data KPI untuk ${period}`}
              deskripsiKosong="Angka terkumpul dari tiket & jadwal yang dikerjakan pada periode ini."
            />
          )}
          {!loading && sortedMembers.map((m) => {
            const solveRate = m.ticketsHandled > 0 ? Math.round((m.ticketsSolved / m.ticketsHandled) * 100) : 0;
            const remRate = m.remindersAssigned > 0 ? Math.round((m.remindersDone / m.remindersAssigned) * 100) : 0;
            const teamCol = warnaTim(m.team_type);
            return (
              <MobileListCard
                key={m.id}
                title={m.name}
                onClick={() => setDrillMember(m)}
                meta={<div className="truncate">{m.team_type.replace('Team ', '')} · {m.jabatan}</div>}
                badges={<MobileCardBadge style={{ background: `${teamCol}1a`, color: teamCol }}>{m.ticketsHandled} tiket</MobileCardBadge>}
                fields={[
                  { label: 'Solve', value: `${solveRate}%` },
                  { label: 'Avg', value: m.avgResolutionDays === 0 ? '—' : `${m.avgResolutionDays}h` },
                  { label: 'Reminder', value: `${remRate}%` },
                  { label: 'LC', value: m.lcAvgScore === 0 ? '—' : m.lcAvgScore },
                  { label: 'Piket', value: `${m.piketFilled} hari` },
                  { label: 'Overdue', value: m.ticketsOverdue, hide: m.ticketsOverdue === 0, valueClass: 'text-red-500 font-bold' },
                ]}
              />
            );
          })}
        </div>

        {/* ── DESKTOP: tabel KPI penuh (TIDAK diubah) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {[
                  { key: 'name' as SortKey,     label: 'Nama',        align: 'left'   },
                  { key: 'tickets' as SortKey,  label: 'Ticket',      align: 'center' },
                  { key: 'solveRate' as SortKey,label: 'Solve Rate',  align: 'center' },
                  { key: 'avgDays' as SortKey,  label: 'Avg Resolusi',align: 'center' },
                  { key: 'remRate' as SortKey,  label: 'Reminder',    align: 'center' },
                  { key: 'lcScore' as SortKey,  label: 'LC Score',    align: 'center' },
                  { key: 'piket' as SortKey,    label: 'Piket',       align: 'center' },
                ].map(col => (
                  <th key={col.key}
                    className={`px-3 py-2.5 font-bold text-slate-500 cursor-pointer select-none whitespace-nowrap text-${col.align}`}
                    onClick={() => handleSort(col.key)}>
                    {col.label}<SortIcon k={col.key} />
                  </th>
                ))}
                <th className="px-3 py-2.5 font-bold text-slate-500 text-center whitespace-nowrap">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-3 py-3.5">
                      <div className="h-3 rounded-full animate-pulse bg-slate-100" style={{ width: j === 0 ? '80%' : '60%' }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && sortedMembers.map((m, idx) => {
                const solveRate  = m.ticketsHandled > 0 ? Math.round((m.ticketsSolved / m.ticketsHandled) * 100) : 0;
                const remRate    = m.remindersAssigned > 0 ? Math.round((m.remindersDone / m.remindersAssigned) * 100) : 0;
                const teamCol    = warnaTim(m.team_type);
                const dayColor   = m.avgResolutionDays === 0 ? '#94a3b8'
                  : m.avgResolutionDays <= 3 ? '#10b981'
                  : m.avgResolutionDays <= 7 ? '#f59e0b' : '#ef4444';
                const lcColor    = m.lcAvgScore === 0 ? '#94a3b8'
                  : m.lcAvgScore >= 80 ? '#10b981'
                  : m.lcAvgScore >= 60 ? '#f59e0b' : '#ef4444';

                return (
                  <tr key={m.id}
                    onClick={() => setDrillMember(m)}
                    className="cursor-pointer transition-colors group"
                    style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}>

                    {/* Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg,${teamCol},${teamCol}cc)` }}>
                          {m.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 leading-tight truncate">{m.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{m.team_type.replace('Team ','')} · {m.jabatan}</div>
                        </div>
                      </div>
                    </td>

                    {/* Tickets */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-black text-slate-700">{m.ticketsHandled}</span>
                      {m.ticketsOverdue > 0 && (
                        <div className="text-[10px] font-bold text-red-600">{m.ticketsOverdue} OD</div>
                      )}
                    </td>

                    {/* Solve Rate */}
                    <td className="px-3 py-3" style={{ minWidth: 100 }}>
                      <ProgressBar value={m.ticketsSolved} max={m.ticketsHandled} h={6} />
                    </td>

                    {/* Avg Days */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-bold" style={{ color: dayColor }}>
                        {m.avgResolutionDays === 0 ? '—' : `${m.avgResolutionDays}h`}
                      </span>
                    </td>

                    {/* Reminder */}
                    <td className="px-3 py-3" style={{ minWidth: 90 }}>
                      <ProgressBar value={m.remindersDone} max={m.remindersAssigned} h={6} />
                    </td>

                    {/* LC Score */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-bold" style={{ color: lcColor }}>
                        {m.lcAvgScore === 0 ? '—' : m.lcAvgScore}
                      </span>
                      {m.lcAttempts > 0 && (
                        <div className="text-[10px] text-slate-500">{m.lcAttempts}x</div>
                      )}
                    </td>

                    {/* Piket */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-bold text-slate-600">{m.piketFilled}</span>
                      <div className="text-[10px] text-slate-500">hari</div>
                    </td>

                    {/* Trend Spark */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center">
                        <MiniSpark values={m.monthlyTickets} color={teamCol} />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && sortedMembers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 text-sm">
                    Tidak ada data untuk periode &amp; filter ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {!loading && sortedMembers.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-50 flex items-center gap-4 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progress bar:</span>
            {[['≥90%', '#10b981'], ['70–89%', '#f59e0b'], ['<70%', '#ef4444']].map(([lbl, c]) => (
              <div key={lbl} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-slate-500 font-medium">{lbl}</span>
              </div>
            ))}
            <span className="text-[10px] text-slate-500 ml-auto italic">Klik baris untuk detail →</span>
          </div>
        )}
      </div>
    </>
  );
}
