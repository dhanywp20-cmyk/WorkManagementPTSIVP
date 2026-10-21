'use client';

/** KontenHalamanRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { MiniPieChart, StatCard, Paginasi } from '@/components/shared';
import { FilterRequest } from '../FilterRequest';
import { IkonTeks } from '@/components/shared/Ikon';
import { DaftarRequest } from '../DaftarRequest';
import { User, ProjectRequest } from '../shared';

export interface KontenHalamanRequestProps {
  assignedPieData: { label: string; value: number; color: string; }[];
  availableYears: string[];
  bisaKelolaRequest: boolean;
  bulkDeleting: boolean;
  currentUser: User;
  divisionPieData: { label: string; value: number; color: string; }[];
  fetchRequests: () => Promise<void>;
  filterDivision: string;
  filterHandler: string;
  filterKebutuhan: string;
  filterMonth: string;
  filterStatus: string;
  filterYear: string;
  filteredRequests: ProjectRequest[];
  formatDate: (dt: string) => string;
  formatDueDate: (dt: string) => string;
  getDueStatus: (due: string | undefined, status: string) => { type: string; label: string; days: number; } | null;
  hal: import("@/components/shared/Paginasi").HasilPaginasi<ProjectRequest>;
  handleOpenDetail: (req: ProjectRequest) => Promise<void>;
  isIVPGuest: boolean;
  isPTS: boolean;
  isTeamPTS: boolean;
  kebutuhanPieData: { label: string; value: number; color: string; }[];
  loading: boolean;
  pimpinan: boolean;
  productPieData: { label: string; value: number; color: string; }[];
  ptsMembersList: string[];
  renderRequestActions: (req: ProjectRequest) => import("react").JSX.Element;
  requests: ProjectRequest[];
  searchQuery: string;
  searchSales: string;
  selectMode: boolean;
  selectedIds: Set<string>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setFilterDivision: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterKebutuhan: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterMonth: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchSales: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  stats: { total: number; pending: number; approved: number; in_progress: number; completed: number; rejected: number; };
  statusPieData: { label: string; value: number; color: string; }[];
  toggleSelectAll: () => void;
  toggleSelectId: (id: string) => void;
  unreadMsgMap: Record<string, number>;
}

export function KontenHalamanRequest({ assignedPieData, availableYears, bisaKelolaRequest, bulkDeleting, currentUser, divisionPieData, fetchRequests, filterDivision, filterHandler, filterKebutuhan, filterMonth, filterStatus, filterYear, filteredRequests, formatDate, formatDueDate, getDueStatus, hal, handleOpenDetail, isIVPGuest, isPTS, isTeamPTS, kebutuhanPieData, loading, pimpinan, productPieData, ptsMembersList, renderRequestActions, requests, searchQuery, searchSales, selectMode, selectedIds, setBulkConfirm, setFilterDivision, setFilterHandler, setFilterKebutuhan, setFilterMonth, setFilterStatus, setFilterYear, setSearchQuery, setSearchSales, setSelectMode, setSelectedIds, setShowNewFormModal, stats, statusPieData, toggleSelectAll, toggleSelectId, unreadMsgMap }: KontenHalamanRequestProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 animate-slide-up anim-d80">
          {[
            { label: 'Total', value: stats.total, sub: 'Semua request', accent: '#4f46e5', onClick: () => setFilterStatus('all'), active: filterStatus === 'all' },
            { label: 'Pending', value: stats.pending, sub: 'Menunggu approval', accent: '#b45309', onClick: () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending'), active: filterStatus === 'pending' },
            { label: 'In Progress', value: stats.in_progress, sub: 'Sedang dikerjakan', accent: '#1d4ed8', onClick: () => setFilterStatus(filterStatus === 'in_progress' ? 'all' : 'in_progress'), active: filterStatus === 'in_progress' },
            { label: 'Completed', value: stats.completed, sub: 'Selesai ditangani', accent: '#047857', onClick: () => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed'), active: filterStatus === 'completed' },
            { label: 'Rejected', value: stats.rejected, sub: 'Ditolak', accent: '#b91c1c', onClick: () => setFilterStatus(filterStatus === 'rejected' ? 'all' : 'rejected'), active: filterStatus === 'rejected' },
          ].map((card, i) => <StatCard key={i} {...card} />)}
        </div>

        {/* Charts - guest sees handler + product, PTS sees all 3 */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5 sm:gap-4 animate-zoom-in anim-d160">
          {isPTS ? (
            <>
              <MiniPieChart data={statusPieData} title="Status Distribution" icon="🥧"
                activeFilter={filterStatus !== 'all' ? (() => { const rev: Record<string,string> = { pending:'Pending', approved:'Approved', in_progress:'In Progress', completed:'Completed', rejected:'Rejected' }; return rev[filterStatus]; })() : undefined}
                onSliceClick={label => {
                  const map: Record<string, string> = { Pending: 'pending', Approved: 'approved', 'In Progress': 'in_progress', Completed: 'completed', Rejected: 'rejected' };
                  setFilterStatus(prev => prev === (map[label] || label) ? 'all' : (map[label] || label));
                }} />
              <MiniPieChart data={divisionPieData} title="Divisi Sales" icon="🥧"
                activeFilter={filterDivision !== 'all' ? filterDivision : undefined}
                onSliceClick={label => { setFilterDivision(prev => prev === label ? 'all' : label); }} />
              <MiniPieChart data={assignedPieData} title="Team PTS Handler" icon="👥"
                activeFilter={filterHandler !== 'all' ? filterHandler : undefined}
                onSliceClick={label => setFilterHandler(prev => prev === label ? 'all' : label)} />
              <MiniPieChart data={kebutuhanPieData} title="Kebutuhan" icon="🎯"
                centerValue={requests.length} centerLabel="REQUEST"
                activeFilter={filterKebutuhan !== 'all' ? filterKebutuhan : undefined}
                onSliceClick={label => setFilterKebutuhan(prev => prev === label ? 'all' : label)} />
            </>
          ) : (
            <>
              <MiniPieChart data={statusPieData} title="Status Request Saya" icon="🥧" />
              <MiniPieChart data={assignedPieData} title="Team PTS Handler" icon="👥"
                activeFilter={filterHandler !== 'all' ? filterHandler : undefined}
                onSliceClick={label => setFilterHandler(prev => prev === label ? 'all' : label)} />
              <MiniPieChart data={productPieData} title="Product" icon="📦" />
              <MiniPieChart data={kebutuhanPieData} title="Kebutuhan" icon="🎯"
                centerValue={requests.length} centerLabel="REQUEST"
                activeFilter={filterKebutuhan !== 'all' ? filterKebutuhan : undefined}
                onSliceClick={label => setFilterKebutuhan(prev => prev === label ? 'all' : label)} />
            </>
          )}
        </div>

        

        {/* TICKET LIST — matching reference style */}
        <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

          {/* Header with title + actions — same as reference */}
          <div className="flex flex-wrap items-center justify-between px-3 py-2 sm:px-6 sm:py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ticket List</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{loading ? '…' : filteredRequests.length}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {bisaKelolaRequest && (
                <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {selectMode ? '✕ Batal' : '☑ Select'}
                </button>
              )}
              <button onClick={fetchRequests} disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60" style={{ background: 'white' }}>
                <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Search + filter grid — labeled like reference */}
          <FilterRequest
            availableYears={availableYears} filterHandler={filterHandler} filterMonth={filterMonth} filterStatus={filterStatus} filterYear={filterYear} ptsMembersList={ptsMembersList} searchQuery={searchQuery} searchSales={searchSales} setFilterHandler={setFilterHandler} setFilterMonth={setFilterMonth} setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setSearchQuery={setSearchQuery} setSearchSales={setSearchSales}
          />

          {/* Active filter chips — inside table */}
          {/* Bulk delete bar — admin only, selectMode only */}
          {selectMode && bisaKelolaRequest && selectedIds.size > 0 && (
            <div className="px-3 py-1.5 sm:px-6 sm:py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(13,148,136,0.07)' }}>
              <span className="text-sm font-bold text-teal-700">{selectedIds.size} request dipilih</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                  className="tombol-bahaya text-xs font-bold px-4 py-1.5 rounded-kontrol disabled:opacity-50 flex items-center gap-1">
                  {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
                </button>
              </div>
            </div>
          )}

          {(filterStatus !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterHandler !== 'all' || filterDivision !== 'all' || filterKebutuhan !== 'all' || searchQuery || searchSales) && (
            <div className="px-3 py-1.5 sm:px-6 sm:py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5 sm:gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
              {filterStatus !== 'all' && (
                <button onClick={() => setFilterStatus('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#d97706' }}>Status: {filterStatus} ✕</button>
              )}
              {filterYear !== 'all' && (
                <button onClick={() => setFilterYear('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0891b2' }}>Year: {filterYear} ✕</button>
              )}
              {filterMonth !== 'all' && (
                <button onClick={() => setFilterMonth('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0e7490' }}>Bulan: {filterMonth} ✕</button>
              )}
              {filterHandler !== 'all' && (
                <button onClick={() => setFilterHandler('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>Handler: {filterHandler} ✕</button>
              )}
              {filterDivision !== 'all' && (
                <button onClick={() => setFilterDivision('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}>Division: {filterDivision} ✕</button>
              )}
              {filterKebutuhan !== 'all' && (
                <button onClick={() => setFilterKebutuhan('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0d9488' }}>Kebutuhan: {filterKebutuhan} ✕</button>
              )}
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>Search: {searchQuery} ✕</button>
              )}
              {searchSales && (
                <button onClick={() => setSearchSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>Sales: {searchSales} ✕</button>
              )}
              <button onClick={() => { 
                setFilterStatus('all'); setFilterYear('all'); setFilterMonth('all'); 
                setFilterHandler('all'); setFilterDivision('all'); setFilterKebutuhan('all'); setSearchQuery(''); setSearchSales('');
                try { ['frp_filterStatus','frp_filterYear','frp_filterMonth','frp_filterHandler','frp_filterDivision','frp_filterKebutuhan','frp_searchQuery','frp_searchSales'].forEach(k => sessionStorage.removeItem(k)); } catch {}
              }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}><IkonTeks nama="🗑" />Reset Semua</button>
            </div>
          )}
          <DaftarRequest
            bisaKelolaRequest={bisaKelolaRequest} currentUser={currentUser} filterMonth={filterMonth} filterStatus={filterStatus} filterYear={filterYear} filteredRequests={filteredRequests} formatDate={formatDate} formatDueDate={formatDueDate} getDueStatus={getDueStatus} hal={hal} handleOpenDetail={handleOpenDetail} isIVPGuest={isIVPGuest} isPTS={isPTS} isTeamPTS={isTeamPTS} loading={loading} pimpinan={pimpinan} renderRequestActions={renderRequestActions} requests={requests} searchQuery={searchQuery} searchSales={searchSales} selectMode={selectMode} selectedIds={selectedIds} setFilterMonth={setFilterMonth} setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setSearchQuery={setSearchQuery} setSearchSales={setSearchSales} setShowNewFormModal={setShowNewFormModal} toggleSelectAll={toggleSelectAll} toggleSelectId={toggleSelectId} unreadMsgMap={unreadMsgMap}
          />
        </div>
      </div>
    </>
  );
}
