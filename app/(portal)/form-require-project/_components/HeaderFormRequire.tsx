'use client';

/** HeaderFormRequire - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { PageHeader } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { IkonTeks } from '@/components/shared/Ikon';
import { ProjectRequest, statusConfig } from './shared';

export interface HeaderFormRequireProps {
  bellDropdownOpen: boolean;
  handleOpenDetail: (req: ProjectRequest) => Promise<void>;
  pimpinan: boolean;
  requests: ProjectRequest[];
  setBellDropdownOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function HeaderFormRequire({ bellDropdownOpen, handleOpenDetail, pimpinan, requests, setBellDropdownOpen, setShowNewFormModal }: HeaderFormRequireProps) {
  return (
    <>
      <PageHeader icon="🏗️" title="Request Design Project" subtitle="IVP Product — AV Solution Request" color="#7c3aed" colorLight="#6d28d9">
        {/* Bell notif — tiket pending/in_progress */}
        {(() => {
          const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
          if (activeTickets.length === 0) return null;
          return (
            <div className="relative">
              <button
                onClick={() => setBellDropdownOpen(o => !o)}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-violet-50"
                style={{ border: '1.5px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.07)' }}>
                <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-violet-500 animate-[wiggle_1.5s_ease-in-out_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {activeTickets.length}
                </span>
              </button>
              {bellDropdownOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-in" style={{ zIndex: Z.dropdown }}>
                  <div className="bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-3 flex items-center justify-between">
                    <p className="text-white text-xs font-bold"><IkonTeks nama="🔔" />Tiket Aktif ({activeTickets.length})</p>
                    <button aria-label="Tutup" onClick={() => setBellDropdownOpen(false)} className="text-white/70 hover:text-white text-xs font-bold">✕</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {activeTickets.map(req => {
                      const sc = statusConfig[req.status];
                      return (
                        <button key={req.id} onClick={() => { setBellDropdownOpen(false); handleOpenDetail(req); }}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left">
                          <span className={`mt-0.5 text-[11px] font-bold px-1.5 py-0.5 whitespace-nowrap ${sc.color} ${sc.bg}`}>{sc.label}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{req.project_name}</p>
                            <p className="text-[11px] text-gray-500 truncate">{req.sales_name} · {req.assign_name || 'Unassigned'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {!pimpinan && (
        <button onClick={() => setShowNewFormModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Buat Request
        </button>
        )}
      </PageHeader>
    </>
  );
}
