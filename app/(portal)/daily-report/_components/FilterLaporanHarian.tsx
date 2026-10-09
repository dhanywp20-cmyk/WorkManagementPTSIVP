'use client';

/** FilterLaporanHarian - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { type TeamUser } from '@/app/(portal)/reminder-schedule/_components/shared';

export interface FilterLaporanHarianProps {
  filterDate: string;
  filterSource: string;
  filterStatus: string;
  filterUser: string;
  lihatSemua: boolean;
  searchProject: string;
  setFilterDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterSource: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterUser: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  teamUsers: TeamUser[];
}

export function FilterLaporanHarian({ filterDate, filterSource, filterStatus, filterUser, lihatSemua, searchProject, setFilterDate, setFilterSource, setFilterStatus, setFilterUser, setSearchProject, teamUsers }: FilterLaporanHarianProps) {
  return (
    <>
      <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[180px]" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)' }}>
          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input aria-label="Cari project / lokasi..." value={searchProject} onChange={e => setSearchProject(e.target.value)} placeholder="Cari project / lokasi..." className="bg-transparent outline-none text-xs text-slate-700 placeholder-slate-400 w-full" />
        </div>
        {lihatSemua && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', minWidth: '150px' }}>
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} aria-label="Saring per team handler" className="bg-transparent outline-none text-xs text-slate-700 w-full">
              <option value="">Team Handler</option>
              {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', minWidth: '130px' }}>
          <select aria-label="All Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent outline-none text-xs text-slate-700 w-full">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Selesai</option>
            <option value="in progress">Proses</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', minWidth: '140px' }}>
          <select aria-label="Semua Platform" value={filterSource} onChange={e => setFilterSource(e.target.value)} className="bg-transparent outline-none text-xs text-slate-700 w-full">
            <option value="">Semua Platform</option>
            <option value="ticket">Ticketing</option>
            <option value="reminder">Schedule</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)' }}>
          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} aria-label="Saring per tanggal" className="bg-transparent outline-none text-xs text-slate-700" />
        </div>
        {(filterDate || filterUser || filterStatus || filterSource || searchProject) && (
          <button onClick={() => { setFilterDate(''); setFilterUser(''); setFilterStatus(''); setFilterSource(''); setSearchProject(''); }} className="px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-all">Reset</button>
        )}
      </div>
    </>
  );
}
