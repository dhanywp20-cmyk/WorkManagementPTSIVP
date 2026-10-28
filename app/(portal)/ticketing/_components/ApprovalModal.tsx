'use client';
import type { ReactNode } from 'react';
import { Modal, PilihPenugasan, TombolSetujui, TombolTolak } from '@/components/shared';
import type { Ticket, TeamMember, ProjectReminderRef } from './shared';

/**
 * Modal "Ticket Approval" (Admin/Manager menyetujui tiket Waiting Approval). State & handler tetap di
 * page.tsx, komponen ini murni presentasional. Kerangka & tombol: pola persetujuan bersama
 * (components/shared/Persetujuan.tsx) - sama dengan Request Schedule, Request Design Project, dst.
 */
export function ApprovalModal({
  pendingApprovalTickets, projectReminders, approvalAssignees, setApprovalAssignees,
  teamPTSMembers, supervisorMembers, approvingId, uploading,
  jalankanApproveTicket, rejectTicket, onClose,
}: {
  pendingApprovalTickets: Ticket[];
  projectReminders: Record<string, ProjectReminderRef[]>;
  approvalAssignees: Record<string, string>;
  setApprovalAssignees: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  teamPTSMembers: TeamMember[];
  supervisorMembers: TeamMember[];
  approvingId: string | null;
  uploading: boolean;
  jalankanApproveTicket: (ticket: Ticket) => void;
  rejectTicket: (ticket: Ticket) => void;
  onClose: () => void;
}) {
  const pilihan = [
    ...teamPTSMembers.map(m => ({ v: m.name, l: m.name, grup: 'Langsung ke Team PTS' })),
    ...supervisorMembers.map(m => ({ v: `SUP::${m.id}::${m.name}`, l: `${m.name} (Supervisor)`, grup: 'Lewat Supervisor' })),
  ];
  return (
    <Modal buka onTutup={onClose} judul="Ticket Approval" keterangan={`${pendingApprovalTickets.length} ticket menunggu persetujuan`} ukuran="lg">
      <div className="space-y-4">
        {pendingApprovalTickets.length === 0 ? (
          <p className="text-center py-12 text-slate-500 font-medium">Tidak ada ticket yang menunggu persetujuan.</p>
        ) : pendingApprovalTickets.map((ticket) => {
          const refs = projectReminders[(ticket.project_name || '').trim().toLowerCase()] ?? [];
          const saran = Array.from(new Map(refs.filter(r => r.assign_name && r.assign_name !== '-').map(r => [r.assign_name, r])).values());
          return (
            <div key={ticket.id} className="rounded-kartu border border-slate-200 bg-white p-4">
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{ticket.project_name}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{ticket.issue_case}</p>
                  {ticket.description && <p className="text-xs text-slate-500 mt-1">{ticket.description}</p>}
                  <div className="flex gap-3 mt-2 flex-wrap text-xs text-slate-500">
                    {ticket.customer_phone && <span>Customer: {ticket.customer_phone}</span>}
                    {ticket.sales_name && <span>Sales: {ticket.sales_name}</span>}
                    {ticket.sn_unit && <span>SN: {ticket.sn_unit}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Dibuat oleh {ticket.created_by || '-'} · {ticket.date}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">Menunggu Persetujuan</span>
              </div>

              {/* ── Referensi Project dari Reminder Schedule ── */}
              {refs.length > 0 && (
                <div className="mb-3 rounded-kontrol border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="text-xs font-bold text-emerald-800 mb-2">Referensi project di Reminder Schedule</p>
                  {refs.map((ref, idx) => {
                    const bastDate = ref.due_date ? new Date(ref.due_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                    const wy = ref.warranty_years as 1 | 2 | 3 | null | undefined;
                    let warrantyBadge: ReactNode = null;
                    if (wy && ref.due_date) {
                      const expiry = new Date(ref.due_date + 'T00:00:00');
                      expiry.setFullYear(expiry.getFullYear() + wy);
                      const today = new Date(); today.setHours(0, 0, 0, 0);
                      const isIn = today <= expiry;
                      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
                      const expiryStr = expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                      warrantyBadge = (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${isIn ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-700'}`}>
                          {isIn ? 'In Warranty' : 'Out of Warranty'}
                          <span className="opacity-70">· s/d {expiryStr} ({isIn ? `sisa ${diffDays}h` : `lewat ${Math.abs(diffDays)}h`})</span>
                        </span>
                      );
                    }
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1.5">
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">{ref.category}</span>
                        <span className="text-slate-600">BAST: <strong className="text-slate-800">{bastDate}</strong></span>
                        {ref.assign_name && ref.assign_name !== '-' && <span className="text-slate-600">Handler: <strong className="text-slate-800">{ref.assign_name}</strong></span>}
                        {warrantyBadge && <div className="w-full mt-0.5">{warrantyBadge}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 space-y-2">
                {saran.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5">Saran handler (pernah menangani project ini)</p>
                    <div className="flex flex-wrap gap-2">
                      {saran.map((ref, idx) => {
                        const dipilih = approvalAssignees[ticket.id] === ref.assign_name;
                        return (
                          <button key={idx} type="button" onClick={() => setApprovalAssignees(prev => ({ ...prev, [ticket.id]: ref.assign_name }))}
                            className={`px-3 py-1 rounded-kontrol text-xs font-bold border transition-all ${dipilih ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                            {ref.assign_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <PilihPenugasan nilai={approvalAssignees[ticket.id] ?? ''} onUbah={v => setApprovalAssignees(prev => ({ ...prev, [ticket.id]: v }))}
                  pilihan={pilihan} kosong="- Pilih handler / Supervisor -" />
                <div className="flex justify-end gap-2 pt-1">
                  <TombolTolak onClick={() => rejectTicket(ticket)} disabled={uploading} />
                  <TombolSetujui onClick={() => jalankanApproveTicket(ticket)} disabled={uploading || !approvalAssignees[ticket.id]}>
                    {approvingId === ticket.id ? 'Memproses...' : 'Setujui & Tugaskan'}
                  </TombolSetujui>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
