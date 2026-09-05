'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Ico } from './Ico';
import type { Ticket, TeamMember, User } from './shared';

/**
 * Header "Ticket List" (Select/Refresh/Export) + baris search/filter +
 * bar bulk-delete + chip filter aktif - dipindah dari
 * app/ticketing/page.tsx apa adanya (JSX identik). State & handler tetap
 * di page.tsx, komponen ini murni presentasional.
 *
 * Dipanggil sebagai children dari <div ref={ticketListRef}> di page.tsx -
 * ref-nya sengaja tetap di page.tsx karena elemen yang sama juga
 * membungkus daftar tiket (mobile/desktop) yang belum diekstrak.
 */
export function FilterBar({
  canManageTickets, selectMode, setSelectMode, setSelectedIds,
  fetchData, loading, onExport, uploading,
  ticketsLoading, filteredTickets,
  searchProject, setSearchProject, searchSalesName, setSearchSalesName,
  searchProduct, setSearchProduct, setProductFilter,
  handlerFilter, setHandlerFilter, teamMembers, selectedHandlerTeam,
  filterStatus, setFilterStatus, currentUser,
  filterYear, setFilterYear, availableYears,
  selectedIds, bulkDeleting, setBulkConfirm,
  salesDivisionFilter, setSalesDivisionFilter, productFilter,
}: {
  canManageTickets: boolean;
  selectMode: boolean;
  setSelectMode: Dispatch<SetStateAction<boolean>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  fetchData: () => void;
  loading: boolean;
  onExport: () => void;
  uploading: boolean;
  ticketsLoading: boolean;
  filteredTickets: Ticket[];
  searchProject: string;
  setSearchProject: Dispatch<SetStateAction<string>>;
  searchSalesName: string;
  setSearchSalesName: Dispatch<SetStateAction<string>>;
  searchProduct: string;
  setSearchProduct: Dispatch<SetStateAction<string>>;
  setProductFilter: Dispatch<SetStateAction<string | null>>;
  handlerFilter: string | null;
  setHandlerFilter: Dispatch<SetStateAction<string | null>>;
  teamMembers: TeamMember[];
  selectedHandlerTeam: "PTS" | "Services";
  filterStatus: string;
  setFilterStatus: Dispatch<SetStateAction<string>>;
  currentUser: User | null;
  filterYear: string;
  setFilterYear: Dispatch<SetStateAction<string>>;
  availableYears: string[];
  selectedIds: Set<string>;
  bulkDeleting: boolean;
  setBulkConfirm: Dispatch<SetStateAction<boolean>>;
  salesDivisionFilter: string | null;
  setSalesDivisionFilter: Dispatch<SetStateAction<string | null>>;
  productFilter: string | null;
}) {
  return (
    <>
      {/* Header with title and actions */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ticket List</span>
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{ticketsLoading ? "..." : filteredTickets.length}</span>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {/* Ketiga tombol memakai kerangka yang SAMA (tinggi, padding, radius,
              ukuran ikon) dan hanya dibedakan oleh peran: Export adalah aksi
              utama sehingga dibuat solid, dua lainnya sekunder sehingga bergaris.
              Sebelumnya tiap tombol punya tinggi & gaya sendiri — Export bahkan
              membesar saat disentuh — sehingga barisnya terlihat tidak rapi. */}
          {canManageTickets && (
            <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 ${selectMode ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Ico name={selectMode ? "close" : "check"} className="w-3.5 h-3.5" />
              {selectMode ? 'Batal' : 'Select'}
            </button>
          )}
          <button onClick={() => fetchData()} disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400">
            <Ico name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={onExport} disabled={uploading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white border border-transparent transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ background: '#be123c' }}>
            {uploading
              ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Ico name="chart" className="w-3.5 h-3.5" />}
            Export
          </button>
        </div>
      </div>

      {/* Integrated search filters row - like the image */}
      <div className="px-6 py-3 border-b border-gray-100" style={{ background: "rgba(255,255,255,0.97)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Project / Location</label>
            <div className="relative">
              <Ico name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input aria-label="Search project / lokasi..."
                type="text"
                value={searchProject}
                onChange={(e) => setSearchProject(e.target.value)}
                placeholder="Search project / lokasi..."
                className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Sales Name</label>
            <div className="relative">
              <Ico name="user" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input aria-label="Search sales name..."
                type="text"
                value={searchSalesName}
                onChange={(e) => setSearchSalesName(e.target.value)}
                placeholder="Search sales name..."
                className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Product</label>
            <div className="relative">
              <Ico name="package" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input aria-label="Cari product..."
                type="text"
                value={searchProduct}
                onChange={(e) => { setSearchProduct(e.target.value); setProductFilter(null); }}
                placeholder="Cari product..."
                className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
            <div className="relative">
              <Ico name="users" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select aria-label="All Handlers"
                value={handlerFilter || ""}
                onChange={(e) => setHandlerFilter(e.target.value || null)}
                className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
              >
                <option value="">All Handlers</option>
                {teamMembers.filter(m => m.team_type?.startsWith(`Team ${selectedHandlerTeam}`)).map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              <Ico name="chevron" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
            <div className="relative">
              <Ico name="tag" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select aria-label="All Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Waiting Approval">⏳ Waiting Approval</option>
                <option value="Pending">🟡 Pending</option>
                <option value="Call">📞 Call</option>
                <option value="Onsite">🚗 Onsite</option>
                <option value="In Progress">🔵 In Progress</option>
                <option value="Solved">✅ Solved</option>
                {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                  <>
                    <option value="Overdue">🚨 Overdue</option>
                    <option value="Solved Overdue">⚠️ Solved Overdue</option>
                  </>
                )}
              </select>
              <Ico name="chevron" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
            <div className="relative">
              <Ico name="calendar" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select aria-label="All Years"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
              >
                <option value="all">All Years</option>
                {availableYears.map((year) => (<option key={year} value={year}>{year}</option>))}
              </select>
              <Ico name="chevron" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk delete bar — admin only, selectMode only */}
      {selectMode && canManageTickets && selectedIds.size > 0 && (
        <div className="px-6 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(220,38,38,0.07)' }}>
          <span className="text-sm font-bold text-red-700">{selectedIds.size} ticket dipilih</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
            <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
              className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size} Ticket`}
            </button>
          </div>
        </div>
      )}

      {/* ── Filter Aktif chips — posisi di bawah filter bar ── */}
      {(filterStatus !== "All" || handlerFilter || salesDivisionFilter || productFilter || searchProject || searchSalesName || searchProduct) && (
        <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: "rgba(255,255,255,0.97)" }}>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
          {filterStatus !== "All" && (
            <button onClick={() => setFilterStatus("All")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#d97706" }}>Status: {filterStatus} ✕</button>
          )}
          {handlerFilter && (
            <button onClick={() => setHandlerFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#7c3aed" }}>Handler: {handlerFilter} ✕</button>
          )}
          {salesDivisionFilter && (
            <button onClick={() => setSalesDivisionFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#ec4899" }}>Division: {salesDivisionFilter} ✕</button>
          )}
          {productFilter && (
            <button onClick={() => { setProductFilter(null); setSearchProduct(""); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#6366f1" }}>📦 {productFilter} ✕</button>
          )}
          {searchProject && (
            <button onClick={() => setSearchProject("")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#475569" }}>🔍 {searchProject} ✕</button>
          )}
          {searchSalesName && (
            <button onClick={() => setSearchSalesName("")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#475569" }}>👤 {searchSalesName} ✕</button>
          )}
          <button onClick={() => { setFilterStatus("All"); setHandlerFilter(null); setSalesDivisionFilter(null); setProductFilter(null); setSearchProduct(""); setSearchProject(""); setSearchSalesName(""); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.25)" }}>🗑️ Reset Semua</button>
        </div>
      )}
    </>
  );
}
