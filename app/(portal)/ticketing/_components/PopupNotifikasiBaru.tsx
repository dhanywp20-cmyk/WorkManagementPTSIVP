'use client';

/** PopupNotifikasiBaru - ringkasan ticket yang perlu perhatian saat halaman dibuka. Semua keadaan tetap milik induk. */
import { Modal, TombolModal } from '@/components/shared';
import { Ticket } from './shared';
import { BarisNotifikasiTicket } from './PopupDaftarNotifikasi';

export interface PopupNotifikasiBaruProps {
  currentUserTeamType: string;
  isTicketOverdue: (ticket: Ticket) => boolean;
  notifications: Ticket[];
  setSelectedTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowNotificationPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowTicketDetailPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showNotificationPopup: boolean;
}

export function PopupNotifikasiBaru({ currentUserTeamType, isTicketOverdue, notifications, setSelectedTicket, setShowNotificationPopup, setShowTicketDetailPopup, showNotificationPopup }: PopupNotifikasiBaruProps) {
  if (!showNotificationPopup || notifications.length === 0) return null;
  const tutup = () => setShowNotificationPopup(false);
  return (
    <Modal buka onTutup={tutup} judul="Notifikasi Ticket" keterangan={`${notifications.length} ticket perlu perhatian`}
      footer={<TombolModal onClick={tutup}>Tutup</TombolModal>}>
      <div className="space-y-2">
        {notifications.map(ticket => (
          <BarisNotifikasiTicket key={ticket.id} ticket={ticket} overdue={isTicketOverdue(ticket)} currentUserTeamType={currentUserTeamType}
            onBuka={() => { setSelectedTicket(ticket); tutup(); setShowTicketDetailPopup(true); }} />
        ))}
      </div>
    </Modal>
  );
}
