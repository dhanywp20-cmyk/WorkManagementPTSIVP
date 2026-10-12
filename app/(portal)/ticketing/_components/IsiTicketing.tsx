'use client';

/** IsiTicketing - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { StatsSection } from './StatsSection';
import { FilterBar } from './FilterBar';
import { TicketListBody } from './TicketListBody';
import { User, TeamMember, Ticket, OverdueSetting } from './shared';

export interface IsiTicketingProps {
  ITEMS_PER_PAGE: 15;
  availableYears: string[];
  bolehUpdateTicket: (t: Ticket) => boolean;
  bukaApprovalUntukTicket: (ticket: Ticket) => void;
  bukaDeleteTicket: (ticket: Ticket) => void;
  bukaDetailTicket: (ticket: Ticket) => void;
  bukaOverdueSetting: (ticket: Ticket) => void;
  bukaReopenTicket: (ticket: Ticket) => void;
  bukaRingkasanAktivitas: (ticket: Ticket) => void;
  bulkDeleting: boolean;
  canApproveAssign: boolean;
  canManageTickets: boolean;
  currentPage: number;
  currentUser: User | null;
  currentUserTeamType: string;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  fetchError: string | null;
  filterStatus: string;
  filterYear: string;
  filteredTickets: Ticket[];
  getOverdueSetting: (ticketId: string) => OverdueSetting | undefined;
  getWarrantyInfo: (projectName: string) => { isIn: boolean; diffDays: number; wy: number; bastStr: string; expiryStr: string; assignName: string; category: string; } | null;
  handlerFilter: string | null;
  isTicketOverdue: (ticket: Ticket) => boolean;
  jalankanCetakTicket: (ticket: Ticket) => Promise<void>;
  jalankanEksporExcel: () => Promise<void>;
  loading: false;
  paginatedTickets: Ticket[];
  productFilter: string | null;
  productStats: { data: { name: string; value: number; color: string; }[]; total: number; };
  salesDivisionFilter: string | null;
  salesDivisionStats: { data: { name: string; value: number; color: string; }[]; total: number; };
  searchProduct: string;
  searchProject: string;
  searchSalesName: string;
  selectMode: boolean;
  selectedHandlerTeam: "PTS" | "Services";
  selectedIds: Set<string>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setCurrentPage: import("react").Dispatch<import("react").SetStateAction<number>>;
  setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
  setHandlerFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setProductFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setSalesDivisionFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setSearchProduct: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchSalesName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedHandlerTeam: import("react").Dispatch<import("react").SetStateAction<"PTS" | "Services">>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  stats: { total: number; pending: number; processing: number; solved: number; overdue: number; solvedOverdue: number; statusData: { name: string; value: number; color: string; }[]; handlerData: { name: string; tickets: number; team: string; }[]; };
  teamMembers: TeamMember[];
  ticketListRef: import("react").RefObject<HTMLDivElement | null>;
  tickets: Ticket[];
  ticketsLoading: boolean;
  toggleSelectAll: () => void;
  toggleSelectId: (id: string) => void;
  totalPages: number;
  uploading: boolean;
  users: User[];
}

export function IsiTicketing({ ITEMS_PER_PAGE, availableYears, bolehUpdateTicket, bukaApprovalUntukTicket, bukaDeleteTicket, bukaDetailTicket, bukaOverdueSetting, bukaReopenTicket, bukaRingkasanAktivitas, bulkDeleting, canApproveAssign, canManageTickets, currentPage, currentUser, currentUserTeamType, fetchData, fetchError, filterStatus, filterYear, filteredTickets, getOverdueSetting, getWarrantyInfo, handlerFilter, isTicketOverdue, jalankanCetakTicket, jalankanEksporExcel, loading, paginatedTickets, productFilter, productStats, salesDivisionFilter, salesDivisionStats, searchProduct, searchProject, searchSalesName, selectMode, selectedHandlerTeam, selectedIds, setBulkConfirm, setCurrentPage, setFetchError, setFilterStatus, setFilterYear, setHandlerFilter, setProductFilter, setSalesDivisionFilter, setSearchProduct, setSearchProject, setSearchSalesName, setSelectMode, setSelectedHandlerTeam, setSelectedIds, stats, teamMembers, ticketListRef, tickets, ticketsLoading, toggleSelectAll, toggleSelectId, totalPages, uploading, users }: IsiTicketingProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

        <StatsSection
          currentUser={currentUser}
          currentUserTeamType={currentUserTeamType}
          stats={stats}
          tickets={tickets}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          handlerFilter={handlerFilter}
          setHandlerFilter={setHandlerFilter}
          ticketListRef={ticketListRef}
          selectedHandlerTeam={selectedHandlerTeam}
          setSelectedHandlerTeam={setSelectedHandlerTeam}
          salesDivisionStats={salesDivisionStats}
          salesDivisionFilter={salesDivisionFilter}
          setSalesDivisionFilter={setSalesDivisionFilter}
          productStats={productStats}
          productFilter={productFilter}
          setProductFilter={setProductFilter}
        />

        {/* ── TICKET LIST (with integrated search/filter bar like image) ── */}
        <div ref={ticketListRef} className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(200,200,200,0.6)", backdropFilter: "blur(12px)" }}>
          <FilterBar
            canManageTickets={canManageTickets}
            selectMode={selectMode}
            setSelectMode={setSelectMode}
            setSelectedIds={setSelectedIds}
            fetchData={fetchData}
            loading={loading}
            onExport={jalankanEksporExcel}
            uploading={uploading}
            ticketsLoading={ticketsLoading}
            filteredTickets={filteredTickets}
            searchProject={searchProject}
            setSearchProject={setSearchProject}
            searchSalesName={searchSalesName}
            setSearchSalesName={setSearchSalesName}
            searchProduct={searchProduct}
            setSearchProduct={setSearchProduct}
            setProductFilter={setProductFilter}
            handlerFilter={handlerFilter}
            setHandlerFilter={setHandlerFilter}
            teamMembers={teamMembers}
            selectedHandlerTeam={selectedHandlerTeam}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            currentUser={currentUser}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            availableYears={availableYears}
            selectedIds={selectedIds}
            bulkDeleting={bulkDeleting}
            setBulkConfirm={setBulkConfirm}
            salesDivisionFilter={salesDivisionFilter}
            setSalesDivisionFilter={setSalesDivisionFilter}
            productFilter={productFilter}
          />

          <TicketListBody
            fetchError={fetchError}
            setFetchError={setFetchError}
            fetchData={fetchData}
            ticketsLoading={ticketsLoading}
            searchProject={searchProject}
            setSearchProject={setSearchProject}
            searchSalesName={searchSalesName}
            setSearchSalesName={setSearchSalesName}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            filteredTickets={filteredTickets}
            paginatedTickets={paginatedTickets}
            tickets={tickets}
            users={users}
            teamMembers={teamMembers}
            isTicketOverdue={isTicketOverdue}
            getOverdueSetting={getOverdueSetting}
            getWarrantyInfo={getWarrantyInfo}
            bolehUpdateTicket={bolehUpdateTicket}
            canApproveAssign={canApproveAssign}
            canManageTickets={canManageTickets}
            currentUserTeamType={currentUserTeamType}
            bukaDetailTicket={bukaDetailTicket}
            bukaRingkasanAktivitas={bukaRingkasanAktivitas}
          cetakTicket={jalankanCetakTicket}
            bukaApprovalUntukTicket={bukaApprovalUntukTicket}
            bukaReopenTicket={bukaReopenTicket}
            bukaDeleteTicket={bukaDeleteTicket}
            bukaOverdueSetting={bukaOverdueSetting}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            ITEMS_PER_PAGE={ITEMS_PER_PAGE}
            selectMode={selectMode}
            selectedIds={selectedIds}
            toggleSelectId={toggleSelectId}
            toggleSelectAll={toggleSelectAll}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            ticketListRef={ticketListRef}
          />
        </div>
      </div>
    </>
  );
}
