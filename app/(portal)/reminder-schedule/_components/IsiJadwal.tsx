'use client';

/** IsiJadwal - isi halaman (statistik, filter, daftar, kalender); keadaan dari konteks-jadwal.tsx. Asal: dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { StatsSection } from './StatsSection';
import { FilterBar } from './FilterBar';
import { ReminderListBody } from './ReminderListBody';
import { useKonteksJadwal } from './konteks-jadwal';
import { MiniCalendar } from './MiniCalendar';

export function IsiJadwal() {
  const k = useKonteksJadwal();
  const { isAdmin, isGuest, isManager } = k.sesi;
  const { fetchReminders, filteredReminders, listLoading, reminders } = k.data;
  const { doneCount, pendingCount, productPieData, projectPieData, salesPieData, teamPtsPieData, todayCount, totalCount } = k.ringkasan;
  const {
    availableYears, filterCategory, filterStatus, filterYear, productFilter, searchDivisionSales, searchProduct, searchProject, searchSales, searchTeamHandler,
    selectedCalDay, setFilterCategory, setFilterStatus, setFilterYear, setProductFilter, setSearchDivisionSales, setSearchProduct, setSearchProject, setSearchSales,
    setSearchTeamHandler, setSelectedCalDay
  } = k.filter;
  const { calOnlyDay, calendarMonth, setCalOnlyDay, setCalendarMonth, view } = k.tampilan;
  const { bulkDeleting, selectMode, selectedIds, setBulkConfirm, setSelectMode, setSelectedIds } = k.pilih;
  const { handleExportExcel } = k.aksi;
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

                <ReminderListBody />
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
