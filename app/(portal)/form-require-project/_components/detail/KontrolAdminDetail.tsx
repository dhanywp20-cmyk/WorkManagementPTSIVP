'use client';

/** KontrolAdminDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { supabase } from '@/lib/supabase';
import { ProjectRequest } from '../shared';

export interface KontrolAdminDetailProps {
  detailDueStatus: { type: string; label: string; days: number; } | null;
  detailRoomIdx: number;
  detailRoomStatus: "pending" | "approved" | "in_progress" | "completed" | "rejected" | undefined;
  fetchRequests: () => Promise<void>;
  formatDueDate: (dt: string) => string;
  isPTS: boolean;
  isTeamPTS: boolean;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest;
  setAssignModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
}

export function KontrolAdminDetail({ detailDueStatus, detailRoomIdx, detailRoomStatus, fetchRequests, formatDueDate, isPTS, isTeamPTS, notify, selectedRequest, setAssignModal, setSelectedRequest }: KontrolAdminDetailProps) {
  return (
    <>
      {isPTS && !isTeamPTS && (
        <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 shrink-0 bg-rose-500 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="⚙" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            Admin Controls
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Target Selesai</label>
              {detailDueStatus && (
                <div className={`mb-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${detailDueStatus.type === 'overdue' ? 'bg-red-100 text-red-600' : detailDueStatus.type === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                  <Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailDueStatus.label}
                </div>
              )}
              <div className="flex gap-1.5">
                <input type="date" defaultValue={selectedRequest.due_date || ''} id="detail_due_date"
                  className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-teal-400 outline-none bg-white" />
                <button onClick={async () => {
                  const val = (document.getElementById('detail_due_date') as HTMLInputElement)?.value;
                  const { error } = await supabase.from('project_requests').update({ due_date: val || null }).eq('id', selectedRequest.id);
                  if (!error) { notify('success', val ? `Target: ${formatDueDate(val)}` : 'Dihapus.'); setSelectedRequest(prev => prev ? { ...prev, due_date: val || undefined } : null); fetchRequests(); }
                  else notify('error', 'Gagal.');
                }} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all">OK</button>
              </div>
            </div>
            {detailRoomStatus !== 'pending' && detailRoomStatus !== 'rejected' && (
              <button onClick={() => setAssignModal({ open: true, req: selectedRequest, roomIdx: detailRoomIdx })}
                className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 py-2 rounded-xl text-sm font-bold transition-all">
                <IkonTeks nama="👥" />Re-assign Tim PTS{detailRoomIdx > 0 ? ` — ${(selectedRequest.rooms||[])[detailRoomIdx - 1]?.room_name || `Ruangan ${detailRoomIdx + 1}`}` : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
