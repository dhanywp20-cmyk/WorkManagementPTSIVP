'use client';

import { createContext, useContext } from 'react';
import type { User, TeamMember, Ticket, OverdueSetting } from './shared';

export interface NilaiKonteksTicket {
  sesi: {
    currentUser: User | null;
    currentUserTeamType: string;
    teamMembers: TeamMember[];
    users: User[];
  };
  izin: {
    bolehUpdateTicket: (t: Ticket) => boolean;
    canApproveAssign: boolean;
    canManageTickets: boolean;
  };
  data: {
    fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
    fetchError: string | null;
    filteredTickets: Ticket[];
    getOverdueSetting: (ticketId: string) => OverdueSetting | undefined;
    getWarrantyInfo: (projectName: string) => { isIn: boolean; diffDays: number; wy: number; bastStr: string; expiryStr: string; assignName: string; category: string; } | null;
    isTicketOverdue: (ticket: Ticket) => boolean;
    loading: false;
    paginatedTickets: Ticket[];
    setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    ticketListRef: import("react").RefObject<HTMLDivElement | null>;
    tickets: Ticket[];
    ticketsLoading: boolean;
    uploading: boolean;
  };
  ringkasan: {
    productStats: { data: { name: string; value: number; color: string; }[]; total: number; };
    salesDivisionStats: { data: { name: string; value: number; color: string; }[]; total: number; };
    stats: { total: number; pending: number; processing: number; solved: number; overdue: number; solvedOverdue: number; statusData: { name: string; value: number; color: string; }[]; handlerData: { name: string; tickets: number; team: string; }[]; };
  };
  filter: {
    availableYears: string[];
    filterStatus: string;
    filterYear: string;
    handlerFilter: string | null;
    productFilter: string | null;
    salesDivisionFilter: string | null;
    searchProduct: string;
    searchProject: string;
    searchSalesName: string;
    selectedHandlerTeam: "PTS" | "Services";
    setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
    setHandlerFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setProductFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setSalesDivisionFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setSearchProduct: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchSalesName: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSelectedHandlerTeam: import("react").Dispatch<import("react").SetStateAction<"PTS" | "Services">>;
  };
  halaman: {
    ITEMS_PER_PAGE: 15;
    currentPage: number;
    setCurrentPage: import("react").Dispatch<import("react").SetStateAction<number>>;
    totalPages: number;
  };
  pilih: {
    bulkDeleting: boolean;
    selectMode: boolean;
    selectedIds: Set<string>;
    setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    toggleSelectAll: () => void;
    toggleSelectId: (id: string) => void;
  };
  aksi: {
    bukaApprovalUntukTicket: (ticket: Ticket) => void;
    bukaDeleteTicket: (ticket: Ticket) => void;
    bukaDetailTicket: (ticket: Ticket) => void;
    bukaOverdueSetting: (ticket: Ticket) => void;
    bukaReopenTicket: (ticket: Ticket) => void;
    bukaRingkasanAktivitas: (ticket: Ticket) => void;
    jalankanCetakTicket: (ticket: Ticket) => Promise<void>;
    jalankanEksporExcel: () => Promise<void>;
  };
}

export const KonteksTicket = createContext<NilaiKonteksTicket | null>(null);

export function useKonteksTicket(): NilaiKonteksTicket {
  const k = useContext(KonteksTicket);
  if (!k) throw new Error('useKonteksTicket harus di dalam <KonteksTicket.Provider>');
  return k;
}
