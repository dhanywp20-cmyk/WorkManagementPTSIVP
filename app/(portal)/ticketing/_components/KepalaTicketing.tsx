'use client';

/** KepalaTicketing - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { PageHeader } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { User, Ticket } from './shared';
import { type NewTicketForm } from './NewTicketModal';

export interface KepalaTicketingProps {
  canApproveAssign: boolean;
  canCreateTicket: boolean;
  canManageTickets: boolean;
  currentUser: User | null;
  currentUserTeamType: string;
  fetchProjectReminders: (_ticketList?: Ticket[]) => Promise<void>;
  notifications: Ticket[];
  pendingApprovalTickets: Ticket[];
  pendingServicesApprovalTickets: Ticket[];
  setApprovalAssignees: import("react").Dispatch<import("react").SetStateAction<Record<string, string>>>;
  setNewTicket: import("react").Dispatch<import("react").SetStateAction<NewTicketForm>>;
  setShowAccountSettings: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowApprovalModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowNewTicket: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowNotifications: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowReminderSchedule: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowServicesApprovalModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showNewTicket: boolean;
  showNotifications: boolean;
}

export function KepalaTicketing({ canApproveAssign, canCreateTicket, canManageTickets, currentUser, currentUserTeamType, fetchProjectReminders, notifications, pendingApprovalTickets, pendingServicesApprovalTickets, setApprovalAssignees, setNewTicket, setShowAccountSettings, setShowApprovalModal, setShowNewTicket, setShowNotifications, setShowReminderSchedule, setShowServicesApprovalModal, showNewTicket, showNotifications }: KepalaTicketingProps) {
  return (
    <>
      <PageHeader icon="🎫" title="Ticket Troubleshooting" color="#dc2626" colorLight="#991b1b">
        {/* Bell notif */}
        {currentUser?.role !== "guest" && (
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-xl transition-all hover:bg-red-50 border-2 border-transparent hover:border-red-200" title="Notifications">
            <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "#f59e0b" }}>
                {notifications.length}
              </span>
            )}
          </button>
        )}

        {/* Approval button */}
        {canApproveAssign && pendingApprovalTickets.length > 0 && (
          <button onClick={() => { setApprovalAssignees({}); fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#ea580c,#c2410c)", boxShadow: "0 2px 8px rgba(234,88,12,0.35)" }}>
            <IkonTeks nama="⏳" />Approval
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingApprovalTickets.length}</span>
          </button>
        )}

        {/* Services Approval button */}
        {currentUserTeamType === "Team Services" && pendingServicesApprovalTickets.length > 0 && (
          <button onClick={() => setShowServicesApprovalModal(true)} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#db2777,#be185d)", boxShadow: "0 2px 8px rgba(219,39,119,0.35)" }}>
            <IkonTeks nama="🔧" />Ticket Masuk
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingServicesApprovalTickets.length}</span>
          </button>
        )}

        {/* Reminder button */}
        {canManageTickets && (
          <button onClick={() => { setShowReminderSchedule(true); setShowAccountSettings(false); setShowNewTicket(false); }} className="flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }} title="Reminder harian: Briefing pagi 06.00 WIB">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">Reminder</span>
          </button>
        )}

        {/* New Ticket button */}
        {canCreateTicket && (
          <button onClick={() => { (() => {
            const nextShow = !showNewTicket;
            setShowNewTicket(nextShow);
            setShowAccountSettings(false);
            if (nextShow && currentUser?.role === "guest") {
              setNewTicket(prev => ({
                ...prev,
                sales_name: prev.sales_name || currentUser.full_name || "",
                sales_division: prev.sales_division || currentUser.sales_division || "",
              }));
            }
          })() }} className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.4)" }}>
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </button>
        )}
      </PageHeader>
    </>
  );
}
