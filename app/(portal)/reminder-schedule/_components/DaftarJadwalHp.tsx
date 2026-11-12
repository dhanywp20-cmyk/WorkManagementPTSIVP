'use client';

import type { Reminder } from './shared';
import type { Dispatch, SetStateAction } from 'react';
import type { HasilPaginasi } from '@/components/shared/Paginasi';
import type { TeamUser } from '@/lib/jadwal/tampilan';
import { ViewIconBtn, RescheduleIconBtn, ApproveIconBtn, DeleteIconBtn, MobileListCard, MobileCardBadge, Paginasi } from '@/components/shared';
import { StatusBadge } from './Badges';
import { CATEGORY_CONFIG, isDueToday, layakIncentive, diluarIncentive } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface DaftarJadwalHpProps {
  hal: HasilPaginasi<Reminder[]>;
  setDetailReminder: Dispatch<SetStateAction<Reminder | null>>;
  bolehEditReminder: (r: Reminder) => boolean;
  setRescheduleTarget: Dispatch<SetStateAction<Reminder | null>>;
  canInternalApprove: (r: Reminder) => boolean;
  setInternalApproveTarget: Dispatch<SetStateAction<Reminder | null>>;
  handleInternalReject: (r: Reminder) => void;
  canApproveAssign: boolean;
  bolehLewatiReview: boolean;
  setApproveTarget: Dispatch<SetStateAction<Reminder | null>>;
  setApproveBatchSiblings: Dispatch<SetStateAction<Reminder[]>>;
  setApproveAssignTo: Dispatch<SetStateAction<string>>;
  setApproveDate: Dispatch<SetStateAction<string>>;
  setApproveTime: Dispatch<SetStateAction<string>>;
  handleAdminReject: (r: Reminder) => void;
  currentUser: TeamUser | null;
  openSupervisorAssign: (r: Reminder, group: Reminder[]) => void;
  isAdmin: boolean;
  isManager: boolean;
  syncKeIncentive: (r: Reminder) => Promise<void>;
  syncing: string | null;
  openDeleteModal: (r: Reminder) => void;
  groupedReminders: Reminder[][];
  filteredReminders: Reminder[];
}

export function DaftarJadwalHp({
  hal, setDetailReminder, bolehEditReminder, setRescheduleTarget, canInternalApprove, setInternalApproveTarget, handleInternalReject, canApproveAssign,
  bolehLewatiReview, setApproveTarget, setApproveBatchSiblings, setApproveAssignTo, setApproveDate, setApproveTime, handleAdminReject, currentUser,
  openSupervisorAssign, isAdmin, isManager, syncKeIncentive, syncing, openDeleteModal, groupedReminders, filteredReminders,
}: DaftarJadwalHpProps) {
  return (
    <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
      {hal.potongan.map((group) => {
        const r = group[0];
        const today = isDueToday(r.due_date);
        const dueDate = new Date(r.due_date + 'T00:00:00');
        const uniqueDates = Array.from(new Set(group.map(gr => gr.due_date))).sort();
        const uniqueAssignNames = Array.from(new Set(group.map(gr => gr.assign_name).filter(Boolean)));
        const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const statusCounts: Record<string, number> = {};
        for (const gr of group) statusCounts[gr.status] = (statusCounts[gr.status] || 0) + 1;
        const statusEntries = Object.entries(statusCounts);
        return (
          <MobileListCard
            key={r.id}
            highlight={today}
            accent={today ? '#f87171' : undefined}
            title={(r.project_name || r.title || '').trim() || '—'}
            onClick={() => setDetailReminder(r)}
            meta={<>
              {r.address && <p className="truncate"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.address.split(',')[0]}</p>}
              <p className="truncate">
                {uniqueDates.length > 1
                  ? `🗓️ ${uniqueDates.length} hari: ${fmtShort(uniqueDates[0])}–${fmtShort(uniqueDates[uniqueDates.length - 1])}`
                  : `🗓️ ${dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </p>
            </>}
            badges={<>
              {statusEntries.length === 1
                ? <StatusBadge status={group[0].status} />
                : <div className="flex flex-wrap justify-end gap-0.5">{statusEntries.map(([s, n]) => <span key={s} className="flex items-center gap-0.5"><StatusBadge status={s as any} /><span className="text-[10px] text-gray-500">{n}×</span></span>)}</div>}
              {r.incentive_excluded === true && (
                <MobileCardBadge className="bg-amber-50 text-amber-700 border border-amber-200"
                  title="Sengaja dikeluarkan dari perhitungan Incentive PTS. Jadwalnya tetap tercatat.">
                  <IkonTeks nama="⛔" />di luar Incentive
                </MobileCardBadge>
              )}
            </>}
            fields={[
              { label: 'Kegiatan', value: `${(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon} ${r.category}` },
              { label: 'Product', value: r.product, valueClass: 'text-indigo-600 font-semibold', hide: !r.product },
              { label: 'Sales', value: r.sales_name, hide: !r.sales_name },
              {
                label: 'Handler',
                value: uniqueAssignNames.length === 0 ? '—'
                  : uniqueAssignNames.length === 1 ? uniqueAssignNames[0]
                  : `${uniqueAssignNames.join(', ')} (${uniqueAssignNames.length} orang)`,
              },
              {
                label: 'Catatan', span2: true, valueClass: 'text-gray-500',
                value: r.notes && r.notes.length > 60 ? r.notes.substring(0, 60) + '…' : r.notes,
                hide: !r.notes || r.notes.includes('[REQUEST SALES]'),
              },
            ]}
            actions={<>
              <ViewIconBtn onClick={() => setDetailReminder(r)} title="Detail" />
              {bolehEditReminder(r) && r.status !== 'done' && (
                <RescheduleIconBtn onClick={() => setRescheduleTarget(r)} title="Re-Schedule" />
              )}
              {canInternalApprove(r) && (
                <>
                  <ApproveIconBtn onClick={() => setInternalApproveTarget(r)} title="Setujui & Teruskan ke Admin" pulse />
                  <button aria-label="Tolak" onClick={() => handleInternalReject(r)} title="Tolak"
                    className="w-8 h-8 shrink-0 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </>
              )}
              {canApproveAssign && !r.assigned_to && r.notes?.includes('[REQUEST SALES]') && (r.routing_status !== 'internal_review' || bolehLewatiReview) && (
                <>
                  <ApproveIconBtn onClick={() => { setApproveTarget(r); setApproveBatchSiblings(group.filter(gr => gr.id !== r.id && gr.batch_id === r.batch_id && !gr.assigned_to)); setApproveAssignTo(''); setApproveDate(r.due_date); setApproveTime(r.due_time); }} title="Setujui & Tugaskan" pulse />
                  <button aria-label="Tolak" onClick={() => handleAdminReject(r)} title="Tolak"
                    className="w-8 h-8 shrink-0 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </>
              )}
              {currentUser?.id === r.assigned_supervisor_id && r.routing_status === 'supervisor_assign' && (
                <ApproveIconBtn onClick={() => openSupervisorAssign(r, group)} title="Tugaskan Tim" pulse />
              )}
              {(isAdmin || isManager) && layakIncentive(r) && (
                <button aria-label={`Sync ${r.project_name} ke Incentive PTS`}
                  onClick={() => syncKeIncentive(r)} disabled={syncing === r.id}
                  title={diluarIncentive(r)
                    ? 'Sedang DI LUAR Incentive PTS — klik untuk memasukkannya kembali'
                    : 'Sudah masuk Incentive PTS — klik untuk memastikan ulang'}
                  className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 border ${
                    diluarIncentive(r)
                      ? 'bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border-amber-300'
                      : 'bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border-emerald-200'}`}>
                  {syncing === r.id
                    ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                    : 
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>}
                </button>
              )}
              {(isAdmin || isManager) && (
                <DeleteIconBtn onClick={() => openDeleteModal(r)} title="Hapus" />
              )}
            </>}
          />
        );
      })}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
        <span className="text-xs text-gray-500">{groupedReminders.length} event · {filteredReminders.length} jadwal</span>
      </div>
      <Paginasi {...hal} satuan="event" />
    </div>
  );
}
