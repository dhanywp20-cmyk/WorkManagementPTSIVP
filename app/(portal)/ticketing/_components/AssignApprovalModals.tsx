'use client';
import { Modal, TombolModal, PilihPenugasan, TombolSetujui, TombolTolak, ModalSetujui } from '@/components/shared';
import type { Ticket, TeamMember, User } from './shared';

/**
 * Modal assign/approve "sedang" dari app/ticketing/page.tsx. State & handler tetap di page.tsx, komponen
 * di sini murni presentasional. Kerangka & tombol: Modal + pola persetujuan bersama
 * (components/shared/Persetujuan.tsx) - dulu kepala bergradasi merah / merah muda / kuning sendiri.
 */

// ── BULK DELETE CONFIRM ──

export function BulkDeleteConfirmModal({
  jumlah, onCancel, onConfirm,
}: {
  jumlah: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal buka onTutup={onCancel} judul={`Hapus ${jumlah} Ticket?`} keterangan="Tindakan ini tidak dapat dibatalkan." ukuran="sm"
      footer={<>
        <TombolModal onClick={onCancel}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={onConfirm}>Ya, Hapus Permanen</TombolModal>
      </>}>
      <p className="text-sm text-slate-600">Kamu akan menghapus <strong>{jumlah} ticket</strong> yang dipilih secara permanen dari sistem.</p>
    </Modal>
  );
}

// ── SERVICES APPROVAL (ticket masuk ke Team Services) ──

export function ServicesApprovalModal({
  pendingServicesApprovalTickets, uploading, approveServicesTicket, rejectServicesTicket, onClose,
}: {
  pendingServicesApprovalTickets: Ticket[];
  uploading: boolean;
  approveServicesTicket: (ticket: Ticket) => void;
  rejectServicesTicket: (ticket: Ticket) => void;
  onClose: () => void;
}) {
  return (
    <Modal buka onTutup={onClose} judul="Ticket Masuk - Team Services" keterangan={`${pendingServicesApprovalTickets.length} ticket menunggu konfirmasi. Terima untuk mulai menangani, atau tolak untuk mengembalikan ke Team PTS IVP.`}
      ukuran="lg" lapisan="atas">
      <div className="space-y-4">
        {pendingServicesApprovalTickets.length === 0 ? (
          <p className="text-center py-12 text-slate-500 font-medium">Tidak ada ticket yang menunggu konfirmasi.</p>
        ) : pendingServicesApprovalTickets.map((ticket) => (
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
                  {ticket.address && <span>{ticket.address}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">Dikirim oleh Team PTS IVP · {ticket.date}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">Menunggu Konfirmasi</span>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <TombolTolak onClick={() => rejectServicesTicket(ticket)} disabled={uploading}>Tolak (kembalikan ke PTS)</TombolTolak>
              <TombolSetujui onClick={() => approveServicesTicket(ticket)} disabled={uploading}>Terima &amp; Mulai Proses</TombolSetujui>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── REMINDER SCHEDULE (cron WA) ──

/**
 * Reminder harian handler. Dulu tombol ini menjadwalkan pg_cron `daily-reminder` (fitur lama) - kini
 * reminder dikirim cron Vercel /api/cron/digest (Briefing pagi). Menyimpan jadwal lama justru
 * menghidupkan job pg_cron itu lagi sehingga WA terkirim DOBEL, jadi modal ini hanya menjelaskan.
 */
export function ReminderScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal buka onTutup={onClose} judul="Reminder Harian" keterangan="Dikirim otomatis lewat Briefing pagi"
      footer={<TombolModal onClick={onClose}>Tutup</TombolModal>}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>Setiap pagi pukul <b>06.00 WIB</b> tiap handler menerima satu ringkasan: ticket <b>Pending / In Progress</b> miliknya, ticket yang menunggu lebih dari 24 jam, jadwal reminder &amp; tenggat terdekat.</p>
        <p className="rounded-kontrol border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Kanal (WhatsApp, Telegram, notifikasi HP) dan isi briefing diatur di <b>Admin Panel → Integrations</b>. Jadwal lama di tombol ini sudah tidak dipakai supaya WA tidak terkirim dobel.
        </p>
      </div>
    </Modal>
  );
}

// ── SUPERVISOR ASSIGN TICKET ──

export function SupervisorAssignModal({
  supAssignTicket, supAssignTo, setSupAssignTo, teamPTSMembers, currentUser,
  supAssignSaving, handleSupervisorAssignTicket, onClose,
}: {
  supAssignTicket: Ticket;
  supAssignTo: string;
  setSupAssignTo: (v: string) => void;
  teamPTSMembers: TeamMember[];
  currentUser: User | null;
  supAssignSaving: boolean;
  handleSupervisorAssignTicket: () => void;
  onClose: () => void;
}) {
  return (
    <ModalSetujui buka onTutup={onClose} judul="Tugaskan Ticket" lapisan="maks" labelAksi="Tugaskan"
      keterangan={`${supAssignTicket.project_name} · ${supAssignTicket.issue_case} · ${supAssignTicket.sales_name || '-'}${supAssignTicket.sales_division ? ` (${supAssignTicket.sales_division})` : ''}`}
      onSetujui={handleSupervisorAssignTicket} sibuk={supAssignSaving} bisaKirim={!!supAssignTo}>
      <PilihPenugasan nilai={supAssignTo} onUbah={setSupAssignTo} pilihan={[
        { v: 'SELF', l: 'Saya kerjakan sendiri', grup: 'Saya' },
        ...teamPTSMembers.filter(m => m.name !== currentUser?.full_name).map(m => ({ v: m.name, l: m.name, grup: 'Anggota Tim' })),
      ]} />
    </ModalSetujui>
  );
}
