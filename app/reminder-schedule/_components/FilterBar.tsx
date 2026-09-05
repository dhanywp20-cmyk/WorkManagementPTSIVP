'use client';
import type { Dispatch, SetStateAction } from 'react';
import type { Reminder, Status } from './shared';
import { STATUS_CONFIG, formatDate } from './shared';

/**
 * Header "Schedule List" (Select/Refresh/Export) + baris search/filter +
 * bar bulk-delete + chip filter aktif - dipindah dari
 * app/reminder-schedule/page.tsx apa adanya (JSX identik). State & handler
 * tetap di page.tsx, komponen ini murni presentasional.
 *
 * Dipanggil sebagai children dari wrapper "TICKET LIST" di page.tsx - ref
 * dan pembungkusnya tetap di sana karena elemen yang sama juga membungkus
 * tabel yang belum diekstrak.
 */
export function FilterBar({
  filteredReminders, isAdmin, isManager,
  selectMode, setSelectMode, setSelectedIds,
  fetchReminders, listLoading, handleExportExcel,
  searchProject, setSearchProject, searchSales, setSearchSales,
  searchProduct, setSearchProduct, setProductFilter,
  searchTeamHandler, setSearchTeamHandler,
  filterStatus, setFilterStatus,
  filterYear, setFilterYear, availableYears,
  selectedIds, bulkDeleting, setBulkConfirm,
  filterCategory, setFilterCategory,
  searchDivisionSales, setSearchDivisionSales,
  selectedCalDay, setSelectedCalDay, productFilter,
}: {
  filteredReminders: Reminder[];
  isAdmin: boolean;
  isManager: boolean;
  selectMode: boolean;
  setSelectMode: Dispatch<SetStateAction<boolean>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  fetchReminders: () => void;
  listLoading: boolean;
  handleExportExcel: () => void;
  searchProject: string;
  setSearchProject: (v: string) => void;
  searchSales: string;
  setSearchSales: (v: string) => void;
  searchProduct: string;
  setSearchProduct: (v: string) => void;
  setProductFilter: (v: string | null) => void;
  searchTeamHandler: string;
  setSearchTeamHandler: (v: string) => void;
  filterStatus: Status | 'all';
  setFilterStatus: (v: Status | 'all') => void;
  filterYear: string;
  setFilterYear: (v: string) => void;
  availableYears: string[];
  selectedIds: Set<string>;
  bulkDeleting: boolean;
  setBulkConfirm: Dispatch<SetStateAction<boolean>>;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  searchDivisionSales: string;
  setSearchDivisionSales: (v: string) => void;
  selectedCalDay: string | null;
  setSelectedCalDay: (v: string | null) => void;
  productFilter: string | null;
}) {
  return (
    <>
      {/* ── TICKET LIST header + refresh/export ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Schedule List</span>
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{filteredReminders.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isManager) && (
            <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {selectMode ? '✕ Batal' : '☑ Select'}
            </button>
          )}
          <button onClick={fetchReminders} disabled={listLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60 bg-white">
            <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
          <button onClick={handleExportExcel} disabled={filteredReminders.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 2px 8px rgba(8,145,178,0.3)' }}>
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* ── Search / Filter bar — tepat di bawah TICKET LIST ── */}
      <div className="px-5 py-3 border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Project / Location</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
              <input aria-label="Search project / lokasi..." value={searchProject} onChange={e => setSearchProject(e.target.value)}
                className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                placeholder="Search project / lokasi..." />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Sales Name</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👤</span>
              <input aria-label="Search sales..." value={searchSales} onChange={e => setSearchSales(e.target.value)}
                className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                placeholder="Search sales..." />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">📦 Product</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📦</span>
              <input aria-label="Cari product..." value={searchProduct} onChange={e => { setSearchProduct(e.target.value); setProductFilter(null); }}
                className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                placeholder="Cari product..." />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👷</span>
              <input aria-label="Search handler..." value={searchTeamHandler} onChange={e => setSearchTeamHandler(e.target.value)}
                className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-purple-300 transition-all"
                placeholder="Search handler..." />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🏷️</span>
              <select aria-label="All Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | 'all')}
                className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer transition-all">
                <option value="all">All Status</option>
                {(Object.keys(STATUS_CONFIG) as Status[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📅</span>
              <select aria-label="All Years" value={filterYear} onChange={e => setFilterYear(e.target.value)}
                className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer transition-all">
                <option value="all">All Years</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk delete bar — admin only, selectMode only */}
      {selectMode && (isAdmin || isManager) && selectedIds.size > 0 && (
        <div className="px-5 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(220,38,38,0.07)' }}>
          <span className="text-sm font-bold text-red-700">{selectedIds.size} jadwal dipilih</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
            <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
              className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Filter Aktif chips — di bawah filter bar ── */}
      {(filterCategory !== 'all' || filterStatus !== 'all' || searchSales || searchDivisionSales || searchTeamHandler || searchProject || selectedCalDay || productFilter || searchProduct) && (
        <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
          {filterCategory !== 'all' && <button onClick={() => setFilterCategory('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>🏷️ {filterCategory} ✕</button>}
          {filterStatus !== 'all' && <button onClick={() => setFilterStatus('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#d97706' }}>Status: {STATUS_CONFIG[filterStatus as Status]?.label} ✕</button>}
          {searchSales && <button onClick={() => setSearchSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>👤 {searchSales} ✕</button>}
          {searchDivisionSales && <button onClick={() => setSearchDivisionSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}>Division: {searchDivisionSales} ✕</button>}
          {searchTeamHandler && <button onClick={() => setSearchTeamHandler('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>👷 {searchTeamHandler} ✕</button>}
          {searchProject && <button onClick={() => setSearchProject('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>🔍 {searchProject} ✕</button>}
          {productFilter && <button onClick={() => { setProductFilter(null); setSearchProduct(''); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#6366f1' }}>📦 {productFilter} ✕</button>}
          {selectedCalDay && <button onClick={() => setSelectedCalDay(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0891b2' }}>📅 {formatDate(selectedCalDay)} ✕</button>}
          <button onClick={() => { setFilterCategory('all'); setFilterStatus('all'); setSearchSales(''); setSearchDivisionSales(''); setSearchTeamHandler(''); setSearchProject(''); setSelectedCalDay(null); setProductFilter(null); setSearchProduct(''); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>🗑️ Reset Semua</button>
        </div>
      )}
    </>
  );
}
