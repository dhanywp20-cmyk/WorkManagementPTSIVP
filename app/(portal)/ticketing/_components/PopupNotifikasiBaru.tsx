'use client';

/** PopupNotifikasiBaru - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { Ticket, statusColors } from './shared';

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
  return (
    <>
      {showNotificationPopup && notifications.length > 0 && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-1000 p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
            <div className="p-5 shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3"><span className="text-3xl animate-bounce"><Ikon nama="🔔" ukuran="1em" className="inline-block align-[-0.12em]" /></span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3><p className="text-sm text-white/90">{notifications.length} tickets need attention</p></div></div>
                <button aria-label="Tutup" onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {notifications.map((ticket) => {
                const overdueFlag = isTicketOverdue(ticket);
                return (
                  <div key={ticket.id} {...bisaDiklik(() => { setSelectedTicket(ticket); setShowNotificationPopup(false); setShowTicketDetailPopup(true); })} className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all" style={{ background: "rgba(249,250,251,0.9)", borderColor: overdueFlag ? "#dc2626" : "#e5e7eb" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-1 flex-wrap">{overdueFlag && <span className="text-red-500"><Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /></span>}<p className="font-bold text-sm text-gray-800 truncate">{ticket.project_name}</p></div><p className="text-xs text-gray-500">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-0.5"><IkonTeks nama="⏰" />OVERDUE - Segera tangani!</p>}</div>
                      <div className="shrink-0 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${overdueFlag ? statusColors["Overdue"] : statusColors[currentUserTeamType === "Team Services" ? ticket.services_status || "Pending" : ticket.status]}`}>{overdueFlag ? "🚨 Overdue" : (currentUserTeamType === "Team Services" ? (ticket.services_status || "Pending") : ticket.status)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t shrink-0" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(249,250,251,0.8)" }}><button onClick={() => setShowNotificationPopup(false)} className="w-full bg-linear-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">✕ Tutup</button></div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
