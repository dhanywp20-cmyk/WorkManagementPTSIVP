'use client';

/** PopupDaftarNotifikasi - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
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

export function PopupDaftarNotifikasi({ currentUserTeamType, isTicketOverdue, notifications, setSelectedTicket, setShowNotifications, setShowTicketDetailPopup, showNotifications }: PopupDaftarNotifikasiProps) {
  return (
    <>
      {showNotifications && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
            <div className="p-5 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3"><span className="text-3xl"><Ikon nama="🔔" ukuran="1em" className="inline-block align-[-0.12em]" /></span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3>{notifications.length > 0 && <p className="text-sm text-white/90">{notifications.length} tickets need attention</p>}</div></div>
                <button aria-label="Tutup" onClick={() => setShowNotifications(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><div className="text-6xl mb-4"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></div><p className="text-lg font-medium">No notifications</p><p className="text-sm mt-2">All tickets have been handled</p></div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-4"><div className="space-y-3">{notifications.map((ticket) => { const overdueFlag = isTicketOverdue(ticket); return (
                <div key={ticket.id} {...bisaDiklik(() => { setSelectedTicket(ticket); setShowNotifications(false); setShowTicketDetailPopup(true); })} className={`rounded-xl p-4 border-2 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${overdueFlag ? "bg-red-50 border-red-400" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300"}`}>
                  <div className="flex justify-between items-start mb-3"><div className="flex-1"><div className="flex items-center gap-2 mb-2">{overdueFlag && <span className="text-red-500"><Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /></span>}<p className="font-bold text-lg text-gray-800">{ticket.project_name}</p><span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-bold">{ticket.current_team}</span></div><p className="text-sm text-gray-600 mt-1">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-1"><IkonTeks nama="⏰" />OVERDUE - Segera tangani!</p>}</div><div className="ml-3"><span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${overdueFlag ? statusColors["Overdue"] : statusColors[currentUserTeamType === "Team Services" ? ticket.services_status || "Pending" : ticket.status]}`}>{overdueFlag ? "🚨 Overdue" : (currentUserTeamType === "Team Services" ? (ticket.services_status || "Pending") : ticket.status)}</span></div></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300"><span className="text-xs text-gray-500"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</span><span className="text-sm text-blue-600 font-semibold">Click to view details →</span></div>
                </div>
              )})}</div></div>
            )}
            <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(249,250,251,0.8)" }}><button onClick={() => setShowNotifications(false)} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl font-bold transition-all">Close</button></div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
