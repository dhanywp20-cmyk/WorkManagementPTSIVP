'use client';

/** PopupDaftarNotifikasi - daftar ticket yang perlu perhatian. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { Modal, TombolModal } from '@/components/shared';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { Ticket, formatDateTime, statusColors } from './shared';

export interface PopupDaftarNotifikasiProps {
  currentUserTeamType: string;
  isTicketOverdue: (ticket: Ticket) => boolean;
  notifications: Ticket[];
  setSelectedTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowNotifications: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowTicketDetailPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showNotifications: boolean;
}

/** Satu baris ticket di daftar notifikasi (dipakai juga PopupNotifikasiBaru). */
export function BarisNotifikasiTicket({ ticket, overdue, currentUserTeamType, onBuka, tanggal }: {
  ticket: Ticket; overdue: boolean; currentUserTeamType: string; onBuka: () => void; tanggal?: string;
}) {
  const status = currentUserTeamType === 'Team Services' ? (ticket.services_status || 'Pending') : ticket.status;
  return (
    <div {...bisaDiklik(onBuka)} className={`rounded-kontrol p-3 border cursor-pointer bg-white hover:bg-slate-50 transition-all ${overdue ? 'border-rose-300' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-sm text-slate-800 truncate">{ticket.project_name}</p>
            {ticket.current_team && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">{ticket.current_team}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{ticket.issue_case}</p>
          {overdue && <p className="text-xs text-rose-700 font-bold mt-0.5">Overdue - segera tangani</p>}
          {tanggal && <p className="text-[11px] text-slate-500 mt-1">{tanggal}</p>}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border ${overdue ? statusColors['Overdue'] : statusColors[status]}`}>{overdue ? 'Overdue' : status}</span>
      </div>
    </div>
  );
}

export function PopupDaftarNotifikasi({ currentUserTeamType, isTicketOverdue, notifications, setSelectedTicket, setShowNotifications, setShowTicketDetailPopup, showNotifications }: PopupDaftarNotifikasiProps) {
  if (!showNotifications) return null;
  const tutup = () => setShowNotifications(false);
  return (
    <Modal buka onTutup={tutup} judul="Notifikasi Ticket" ukuran="lg"
      keterangan={notifications.length > 0 ? `${notifications.length} ticket perlu perhatian` : undefined}
      footer={<TombolModal onClick={tutup}>Tutup</TombolModal>}>
      {notifications.length === 0 ? (
        <p className="py-10 text-center text-slate-500 font-medium">Tidak ada notifikasi - semua ticket sudah ditangani.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map(ticket => (
            <BarisNotifikasiTicket key={ticket.id} ticket={ticket} overdue={isTicketOverdue(ticket)} currentUserTeamType={currentUserTeamType}
              tanggal={ticket.created_at ? formatDateTime(ticket.created_at) : undefined}
              onBuka={() => { setSelectedTicket(ticket); tutup(); setShowTicketDetailPopup(true); }} />
          ))}
        </div>
      )}
    </Modal>
  );
}
