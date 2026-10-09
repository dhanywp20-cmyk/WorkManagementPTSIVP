'use client';

/** ModalUpdateStatus - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { User, ProjectRequest, getRoomStatus, getRoomAssignName } from './shared';

export interface ModalUpdateStatusProps {
  bisaKelolaRequest: boolean;
  canSetInProgress: (req: ProjectRequest, roomIdx: number) => boolean;
  currentUser: User;
  handleStatusUpdate: (req: ProjectRequest, newStatus: string, roomIdx?: number) => Promise<void>;
  isTeamPTS: boolean;
  selectedNewStatus: string;
  setSelectedNewStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setStatusUpdateModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  statusUpdateModal: { open: boolean; req: ProjectRequest | null; roomIdx: number; };
}

export function ModalUpdateStatus({ bisaKelolaRequest, canSetInProgress, currentUser, handleStatusUpdate, isTeamPTS, selectedNewStatus, setSelectedNewStatus, setStatusUpdateModal, statusUpdateModal }: ModalUpdateStatusProps) {
  return (
    <>
      {statusUpdateModal.open && statusUpdateModal.req && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: Z.overlayTop }}>
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-200 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Update Status
                </h3>
                <p className="text-blue-100 text-xs mt-0.5 truncate">{statusUpdateModal.req.project_name}</p>
              </div>
              <button aria-label="Tutup" onClick={() => setStatusUpdateModal({ open: false, req: null, roomIdx: 0 })} className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all">✕</button>
            </div>
            <div className="p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pilih Status Baru</p>
              <div className="space-y-2 mb-5">
                {[
                  { value: 'pending', label: '⏳ Pending', color: 'border-amber-300 bg-amber-50 text-amber-700', active: 'border-amber-500 bg-amber-100' },
                  { value: 'in_progress', label: '🔄 In Progress', color: 'border-blue-300 bg-blue-50 text-blue-700', active: 'border-blue-500 bg-blue-100' },
                  { value: 'completed', label: '🏆 Completed', color: 'border-purple-300 bg-purple-50 text-purple-700', active: 'border-purple-500 bg-purple-100' },
                  // rejected hanya untuk admin/superadmin
                  ...(bisaKelolaRequest ? [
                    { value: 'approved', label: '✅ Approved', color: 'border-teal-300 bg-teal-50 text-teal-700', active: 'border-teal-500 bg-teal-100' },
                    { value: 'rejected', label: '❌ Rejected', color: 'border-red-300 bg-red-50 text-red-700', active: 'border-red-500 bg-red-100' },
                  ] : []),
                ].filter(s => {
                  if (s.value === getRoomStatus(statusUpdateModal.req!, statusUpdateModal.roomIdx)) return false;
                  // in_progress hanya bisa diset oleh PTS yang di-assign (atau admin)
                  if (s.value === 'in_progress' && !canSetInProgress(statusUpdateModal.req!, statusUpdateModal.roomIdx)) return false;
                  // completed hanya admin/superadmin atau assigned PTS
                  if (s.value === 'completed' && isTeamPTS && getRoomAssignName(statusUpdateModal.req!, statusUpdateModal.roomIdx) !== currentUser.full_name) return false;
                  return true;
                }).map(s => (
                  <button key={s.value} type="button" onClick={() => setSelectedNewStatus(s.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all font-semibold text-sm ${selectedNewStatus === s.value ? s.active + ' shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedNewStatus === s.value ? 'border-current' : 'border-gray-300'}`}>
                      {selectedNewStatus === s.value && <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStatusUpdateModal({ open: false, req: null, roomIdx: 0 })} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button
                  disabled={!selectedNewStatus}
                  onClick={async () => {
                    if (!selectedNewStatus || !statusUpdateModal.req) return;
                    await handleStatusUpdate(statusUpdateModal.req, selectedNewStatus, statusUpdateModal.roomIdx);
                    setStatusUpdateModal({ open: false, req: null, roomIdx: 0 });
                    setSelectedNewStatus('');
                  }}
                  className="flex-[2] bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white py-2.5 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
