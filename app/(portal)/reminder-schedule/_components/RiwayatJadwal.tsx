'use client';

import type { GuestUser } from './shared';
import type { Dispatch, SetStateAction } from 'react';
import { AuditTrailPanel, FlowSteps, KepalaModal } from '@/components/shared';
import { Reminder } from './shared';

export interface RiwayatJadwalProps {
  showRiwayat: boolean;
  showModeModal: boolean;
  detailReminder: Reminder;
  setShowRiwayat: Dispatch<SetStateAction<boolean>>;
  guestUsers: GuestUser[];
}

export function RiwayatJadwal({
  showRiwayat, showModeModal, detailReminder, setShowRiwayat, guestUsers,
}: RiwayatJadwalProps) {
  return (
    <>{showRiwayat && !showModeModal && (
      <div className="bg-white rounded-kartu shadow-modal fixed inset-3 z-40 md:static md:inset-auto md:z-auto md:max-w-sm md:w-full shrink-0 md:self-start overflow-hidden flex flex-col"
        style={{ maxHeight: '100%' }}>
        <KepalaModal judul="Riwayat Perubahan" keterangan={detailReminder.project_name} onTutup={() => setShowRiwayat(false)} />
        <div className="flex-1 overflow-y-auto">
          <AuditTrailPanel targetId={detailReminder.id} modul="reminder"
            selaluTerbuka sembunyikanBilaKosong={false}
            awal={{
              oleh: (detailReminder.created_by
                ? (guestUsers.find(g => g.username === detailReminder.created_by)?.full_name ?? detailReminder.created_by)
                : detailReminder.sales_name) || null,
              waktu: detailReminder.created_at ?? null,
              keterangan: `Diajukan${detailReminder.sales_division ? ` — ${detailReminder.sales_division}` : ''} · kategori ${detailReminder.category}`
                + (() => {
                  const namaPembuat = detailReminder.created_by
                    ? (guestUsers.find(g => g.username === detailReminder.created_by)?.full_name ?? detailReminder.created_by)
                    : null;
                  return namaPembuat && detailReminder.sales_name && namaPembuat !== detailReminder.sales_name
                    ? ` · atas nama Sales ${detailReminder.sales_name}` : '';
                })(),
            }}
            turunan={[
              ...(detailReminder.assign_name?.trim()
                ? [{ aksi: 'assign', oleh: detailReminder.assign_name,
                     waktu: detailReminder.due_date ?? detailReminder.created_at ?? null,
                     keterangan: `Dikerjakan ${detailReminder.assign_name} — dari data jadwal` }]
                : []),
              ...(detailReminder.status === 'done'
                ? [{ aksi: 'status_change', oleh: detailReminder.assign_name || null,
                     waktu: detailReminder.bast_date ?? detailReminder.due_date ?? null,
                     keterangan: 'Ditandai selesai — dari data jadwal' }]
                : []),
            ]} />
    
          {(() => {
            const r = detailReminder as { routing_status?: string | null; assigned_to?: string | null; assign_name?: string | null; status?: string };
            const sudahAssign = !!((r.assigned_to && r.assigned_to.trim() !== '') || (r.assign_name && r.assign_name.trim() !== ''));
            const selesai     = r.status === 'done';
            const batal       = r.status === 'cancelled';
            const aktif = selesai      ? 5
              : sudahAssign            ? 3
              : r.routing_status === 'internal_review' ? 1
              : 2;
            return (
              <FlowSteps
                judul="Alur Request"
                aktif={aktif}
                dibatalkan={batal}
                steps={[
                  { label: 'Diajukan',  pelaku: detailReminder.sales_name || 'Sales' },
                  { label: 'Diteruskan', pelaku: (() => {
                    const namaDari = (id?: string | null) => id ? guestUsers.find(g => g.id === id)?.full_name : undefined;
                    const r1 = namaDari(detailReminder.internal_sales_id);
                    const r2 = namaDari(detailReminder.internal_sales_id_2);
                    if (r1 && r2) return `${r1} & ${r2}`;
                    if (r1) return r1;
                    const pembuat = guestUsers.find(g => g.username === detailReminder.created_by);
                    if (pembuat?.is_internal_sales) return pembuat.full_name;
                    return 'Sales Internal';
                  })() },
                  { label: 'Di-assign', pelaku: 'Admin' },
                  { label: 'Dikerjakan', pelaku: detailReminder.assign_name || 'Team PTS' },
                  { label: 'Selesai',   pelaku: 'BAST' },
                ]}
              />
            );
          })()}
        </div>
      </div>
    )}</>
  );
}
