'use client';

/** IsiJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { StatsSection } from './StatsSection';
import { FilterBar } from './FilterBar';
import { ReminderListBody } from './ReminderListBody';
import { MiniCalendar } from './MiniCalendar';
import { Status, Reminder, TeamUser, GuestUser } from './shared';

export interface IsiJadwalProps {
  availableYears: string[];
  bolehEditReminder: (r: Reminder) => boolean;
  bulkDeleting: boolean;
  calOnlyDay: string | null;
  calendarMonth: Date;
  canApproveAssign: boolean;
  canInternalApprove: (r: Reminder) => boolean;
  currentUser: TeamUser | null;
  doneCount: number;
  fetchError: string | null;
  fetchReminders: () => Promise<void>;
  filterCategory: string;
  filterStatus: Status | "all";
  filterYear: string;
  filteredReminders: Reminder[];
  groupedReminders: Reminder[][];
  guestUsers: GuestUser[];
  handleAdminReject: (r: Reminder) => void;
  handleExportExcel: () => void;
  handleInternalReject: (r: Reminder) => void;
  isAdmin: boolean;
  isGuest: boolean;
  isManager: boolean;
  listLoading: boolean;
  openDeleteModal: (r: Reminder) => void;
  openSupervisorAssign: (r: Reminder, group: Reminder[]) => void;
  pendingCount: number;
  productFilter: string | null;
  productPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
  projectPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
  reminders: Reminder[];
  salesPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
  searchDivisionSales: string;
  searchProduct: string;
  searchProject: string;
  searchSales: string;
  searchTeamHandler: string;
  selectMode: boolean;
  selectedCalDay: string | null;
  selectedIds: Set<string>;
  setApproveAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveBatchSiblings: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
  setApproveDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setApproveTime: import("react").Dispatch<import("react").SetStateAction<string>>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setCalOnlyDay: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setCalendarMonth: import("react").Dispatch<import("react").SetStateAction<Date>>;
  setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterCategory: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<Status | "all">>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setProductFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setRescheduleTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setSearchDivisionSales: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchProduct: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchSales: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchTeamHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedCalDay: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  syncKeIncentive: (r: Reminder) => Promise<void>;
  syncing: string | null;
  teamPtsPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
  todayCount: number;
  toggleSelectAll: () => void;
  totalCount: number;
  view: "list" | "form";
}

export function IsiJadwal({ availableYears, bolehEditReminder, bulkDeleting, calOnlyDay, calendarMonth, canApproveAssign, canInternalApprove, currentUser, doneCount, fetchError, fetchReminders, filterCategory, filterStatus, filterYear, filteredReminders, groupedReminders, guestUsers, handleAdminReject, handleExportExcel, handleInternalReject, isAdmin, isGuest, isManager, listLoading, openDeleteModal, openSupervisorAssign, pendingCount, productFilter, productPieData, projectPieData, reminders, salesPieData, searchDivisionSales, searchProduct, searchProject, searchSales, searchTeamHandler, selectMode, selectedCalDay, selectedIds, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveTarget, setApproveTime, setBulkConfirm, setCalOnlyDay, setCalendarMonth, setDetailReminder, setFetchError, setFilterCategory, setFilterStatus, setFilterYear, setInternalApproveTarget, setProductFilter, setRescheduleTarget, setSearchDivisionSales, setSearchProduct, setSearchProject, setSearchSales, setSearchTeamHandler, setSelectMode, setSelectedCalDay, setSelectedIds, syncKeIncentive, syncing, teamPtsPieData, todayCount, toggleSelectAll, totalCount, view }: IsiJadwalProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-2.5 py-3 space-y-3 sm:px-5 sm:py-5 sm:space-y-4">
        {view === 'list' && (
          <>
            <StatsSection
              totalCount={totalCount}
              pendingCount={pendingCount}
              doneCount={doneCount}
              todayCount={todayCount}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              selectedCalDay={selectedCalDay}
              setSelectedCalDay={setSelectedCalDay}
              projectPieData={projectPieData}
              salesPieData={salesPieData}
              teamPtsPieData={teamPtsPieData}
              productPieData={productPieData}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              searchDivisionSales={searchDivisionSales}
              setSearchDivisionSales={setSearchDivisionSales}
              searchTeamHandler={searchTeamHandler}
              setSearchTeamHandler={setSearchTeamHandler}
              productFilter={productFilter}
              setProductFilter={setProductFilter}
            />

            {/* Active filter chips */}
            {/* Main area: list + calendar (di HP stack; kalender hanya di desktop).
                items-start SEBELUMNYA berlaku di kedua mode (HP maupun desktop).
                Di flex-col (HP), align-items mengatur SUMBU SILANG yaitu
                LEBAR - items-start berarti kartu daftar TIDAK dipaksa selebar
                layar, melainkan menyusut/melebar mengikuti kontennya sendiri.
                Itu sebabnya berbagai perbaikan truncate/grid sebelumnya di
                dalam kartu ini terlihat "hampir benar" tapi halamannya tetap
                bisa digeser - akar soalnya di sini, bukan di kontennya.
                items-start cuma dibutuhkan di lg: (top-align list & kalender
                berdampingan tanpa saling menyamakan tinggi); di HP dibalik ke
                items-stretch (bawaan) supaya kartu daftar dipatok 100% lebar. */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start">

              {/* ── TICKET LIST ── */}
              <div className="flex-1 min-w-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

                <FilterBar
                  filteredReminders={filteredReminders}
                  isAdmin={isAdmin}
                  isManager={isManager}
                  selectMode={selectMode}
                  setSelectMode={setSelectMode}
                  setSelectedIds={setSelectedIds}
                  fetchReminders={fetchReminders}
                  listLoading={listLoading}
                  handleExportExcel={handleExportExcel}
                  searchProject={searchProject}
                  setSearchProject={setSearchProject}
                  searchSales={searchSales}
                  setSearchSales={setSearchSales}
                  searchProduct={searchProduct}
                  setSearchProduct={setSearchProduct}
                  setProductFilter={setProductFilter}
                  searchTeamHandler={searchTeamHandler}
                  setSearchTeamHandler={setSearchTeamHandler}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterYear={filterYear}
                  setFilterYear={setFilterYear}
                  availableYears={availableYears}
                  selectedIds={selectedIds}
                  bulkDeleting={bulkDeleting}
                  setBulkConfirm={setBulkConfirm}
                  filterCategory={filterCategory}
                  setFilterCategory={setFilterCategory}
                  searchDivisionSales={searchDivisionSales}
                  setSearchDivisionSales={setSearchDivisionSales}
                  selectedCalDay={selectedCalDay}
                  setSelectedCalDay={setSelectedCalDay}
                  productFilter={productFilter}
                />

                <ReminderListBody
                  fetchError={fetchError} setFetchError={setFetchError} fetchReminders={fetchReminders} listLoading={listLoading}
                  filteredReminders={filteredReminders} reminders={reminders} groupedReminders={groupedReminders}
                  filterStatus={filterStatus} filterYear={filterYear} filterCategory={filterCategory}
                  productFilter={productFilter} setProductFilter={setProductFilter}
                  searchProject={searchProject} searchSales={searchSales} searchDivisionSales={searchDivisionSales}
                  searchTeamHandler={searchTeamHandler} searchProduct={searchProduct}
                  setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setFilterCategory={setFilterCategory}
                  setSearchProject={setSearchProject} setSearchSales={setSearchSales} setSearchDivisionSales={setSearchDivisionSales}
                  setSearchTeamHandler={setSearchTeamHandler} setSearchProduct={setSearchProduct}
                  setDetailReminder={setDetailReminder}
                  bolehEditReminder={bolehEditReminder} setRescheduleTarget={setRescheduleTarget}
                  canInternalApprove={canInternalApprove} setInternalApproveTarget={setInternalApproveTarget} handleInternalReject={handleInternalReject}
                  canApproveAssign={canApproveAssign} setApproveTarget={setApproveTarget} setApproveBatchSiblings={setApproveBatchSiblings}
                  setApproveAssignTo={setApproveAssignTo} setApproveDate={setApproveDate} setApproveTime={setApproveTime}
                  handleAdminReject={handleAdminReject}
                  currentUser={currentUser} openSupervisorAssign={openSupervisorAssign}
                  isAdmin={isAdmin} isManager={isManager}
                  syncKeIncentive={syncKeIncentive} syncing={syncing}
                  openDeleteModal={openDeleteModal}
                  selectMode={selectMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds} toggleSelectAll={toggleSelectAll}
                  guestUsers={guestUsers}
                />
              </div>

              {/* ── MINI CALENDAR SIDEBAR — admin & team saja, disembunyikan utk guest/sales.
                   Di HP juga DISEMBUNYIKAN (hidden lg:block) — sebelumnya kalender
                   mendominasi layar & daftar terhimpit hilang. Hanya muncul di desktop. ── */}
              {!isGuest && (
                <div className="hidden lg:block flex-shrink-0">
                  <MiniCalendar
                    reminders={reminders}
                    calendarMonth={calendarMonth}
                    setCalendarMonth={setCalendarMonth}
                    selectedCalDay={calOnlyDay}
                    setSelectedCalDay={setCalOnlyDay}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── FORM VIEW ── (digantikan oleh showFormModal popup) */}

      </div>
    </>
  );
}
