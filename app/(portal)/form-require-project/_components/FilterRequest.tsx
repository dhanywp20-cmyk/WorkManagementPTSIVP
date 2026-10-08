'use client';

/** FilterRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { FilterLipat } from '@/components/shared/FilterLipat';
import { Ikon } from '@/components/shared/Ikon';

export interface FilterRequestProps {
  availableYears: string[];
  filterHandler: string;
  filterMonth: string;
  filterStatus: string;
  filterYear: string;
  ptsMembersList: string[];
  searchQuery: string;
  searchSales: string;
  setFilterHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterMonth: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchSales: import("react").Dispatch<import("react").SetStateAction<string>>;
}

export function FilterRequest({ availableYears, filterHandler, filterMonth, filterStatus, filterYear, ptsMembersList, searchQuery, searchSales, setFilterHandler, setFilterMonth, setFilterStatus, setFilterYear, setSearchQuery, setSearchSales }: FilterRequestProps) {
  return (
    <>
      <div className="px-3 py-2 sm:px-6 sm:py-3 border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
        <FilterLipat kelas="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-6 gap-1.5 sm:gap-3" aktif={[searchSales, filterHandler, filterStatus, filterMonth]}>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Cari Project / Lokasi</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input aria-label="Search project / lokasi..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari project / lokasi..."
                className="w-full rounded-xl pl-8 pr-4 py-1 sm:py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Cari Sales / Requester</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input aria-label="Search sales / requester..." value={searchSales} onChange={e => setSearchSales(e.target.value)}
                placeholder="Cari sales / requester..."
                className="w-full rounded-xl pl-8 pr-4 py-1 sm:py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Team Handler</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"><Ikon nama="👥" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <select aria-label="All Handlers" value={filterHandler} onChange={e => setFilterHandler(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-1 sm:py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                <option value="all">All Handlers</option>
                {ptsMembersList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">▼</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Status</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"><Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <select aria-label="All Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-1 sm:py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">▼</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Filter Year</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <select aria-label="All Years" value={filterYear} onChange={e => setFilterYear(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-1 sm:py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                <option value="all">All Years</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">▼</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Filter Bulan</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"><Ikon nama="🗓" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <select aria-label="All Months" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-1 sm:py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                <option value="all">All Months</option>
                <option value="01">Januari</option>
                <option value="02">Februari</option>
                <option value="03">Maret</option>
                <option value="04">April</option>
                <option value="05">Mei</option>
                <option value="06">Juni</option>
                <option value="07">Juli</option>
                <option value="08">Agustus</option>
                <option value="09">September</option>
                <option value="10">Oktober</option>
                <option value="11">November</option>
                <option value="12">Desember</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">▼</span>
            </div>
          </div>
        </FilterLipat>
      </div>
    </>
  );
}
