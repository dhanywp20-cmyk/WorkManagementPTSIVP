'use client';

/** PopupTicketAktif - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { ProjectRequest, statusConfig } from './shared';
import { Ikon } from '@/components/shared/Ikon';

export interface PopupTicketAktifProps {
  formatDueDate: (dt: string) => string;
  handleOpenDetail: (req: ProjectRequest) => Promise<void>;
  requests: ProjectRequest[];
  setShowTicketPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showTicketPopup: boolean;
}

export function PopupTicketAktif({ formatDueDate, handleOpenDetail, requests, setShowTicketPopup, showTicketPopup }: PopupTicketAktifProps) {
  return (
    <>
      {showTicketPopup && (() => {
        const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
        if (activeTickets.length === 0) return null;
        return (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: Z.overlayMax }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border-2 border-amber-400">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg aria-hidden="true" focusable="false" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Tiket Memerlukan Perhatian</h3>
                    <p className="text-amber-100 text-xs">{activeTickets.length} tiket masih aktif</p>
                  </div>
                </div>
                <button aria-label="Tutup" onClick={() => setShowTicketPopup(false)} className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold">✕</button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {activeTickets.map(req => {
                  const sc = statusConfig[req.status];
                  return (
                    <button key={req.id}
                      onClick={() => { setShowTicketPopup(false); handleOpenDetail(req); }}
                      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-amber-50 transition-all text-left">
                      <span className={`mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{req.project_name}</p>
                        <p className="text-xs text-gray-500 truncate">{req.sales_name}{req.assign_name ? ` · ${req.assign_name}` : ''}</p>
                        {req.due_date && <p className="text-[11px] text-amber-700 font-semibold mt-0.5"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {formatDueDate(req.due_date)}</p>}
                      </div>
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  );
                })}
              </div>
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                <button onClick={() => setShowTicketPopup(false)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all">
                  Tutup & Lihat Nanti
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
        );
      })()}
    </>
  );
}
