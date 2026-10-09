'use client';

/** HeaderDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import { unduhPaketRequest } from '../paket-unduhan';
import { cetakRequest } from '../cetak-request';
import { User, ProjectRequest, ProjectAttachment } from '../shared';
import { type TautanDesain3D } from '../desain-3d-request';

export interface HeaderDetailProps {
  attachments: ProjectAttachment[];
  bisaKelolaRequest: boolean;
  bolehEditRequest: (req: ProjectRequest) => boolean;
  bolehRerouteRequest: (r: ProjectRequest) => boolean;
  canInternalApproveProject: (req: ProjectRequest) => boolean;
  currentUser: User;
  desain3dTools: TautanDesain3D[];
  detailIsPending: boolean;
  detailRoomAssignName: string | undefined;
  detailRoomIdx: number;
  detailRoomStatus: "pending" | "approved" | "in_progress" | "completed" | "rejected" | undefined;
  detailSc: { label: string; color: string; bg: string; border: string; };
  downloadingPackage: boolean;
  formatDate: (dt: string) => string;
  getCCLabel: (req: ProjectRequest) => string;
  handleCloseDetail: () => void;
  handleOpenEditForm: () => void;
  handleReject: (req: ProjectRequest) => void;
  handleStatusUpdate: (req: ProjectRequest, newStatus: string, roomIdx?: number) => Promise<void>;
  isPTS: boolean;
  isTeamPTS: boolean;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest;
  setAssignModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
  setDownloadingPackage: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRerouteTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectedNewStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setStatusUpdateModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
}

export function HeaderDetail({ attachments, bisaKelolaRequest, bolehEditRequest, bolehRerouteRequest, canInternalApproveProject, currentUser, desain3dTools, detailIsPending, detailRoomAssignName, detailRoomIdx, detailRoomStatus, detailSc, downloadingPackage, formatDate, getCCLabel, handleCloseDetail, handleOpenEditForm, handleReject, handleStatusUpdate, isPTS, isTeamPTS, notify, selectedRequest, setAssignModal, setDeleteConfirmText, setDeleteModal, setDownloadingPackage, setInternalApproveTarget, setRerouteTarget, setRerouteTo, setSelectedNewStatus, setStatusUpdateModal }: HeaderDetailProps) {
  return (
    <>
      <div className="bg-gradient-to-r from-teal-700 to-teal-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
        <button aria-label="Tutup" onClick={handleCloseDetail}
          className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-all flex-shrink-0">
          <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-white truncate">{selectedRequest.project_name}</h2>
            {detailRoomAssignName && <span className="bg-white/20 text-white px-2.5 py-1 rounded-full text-xs font-bold border border-white/30">{detailRoomAssignName}</span>}
				  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${detailSc.color} text-white`}>Status : {detailSc.label}</span>
          </div>
          <p className="text-teal-100 text-xs mt-0.5 truncate">
            {selectedRequest.room_name && `${selectedRequest.room_name} · `}
            {selectedRequest.project_location && `📍 ${selectedRequest.project_location} · `}
            {selectedRequest.requester_name} · {selectedRequest.sales_division || ''} · {formatDate(selectedRequest.created_at)}
          </p>
        </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-wrap sm:flex-shrink-0">
          {/* Sales Internal: wajib review dulu sebelum Admin bisa approve */}
          {canInternalApproveProject(selectedRequest) && (
            <>
              <button onClick={() => setInternalApproveTarget(selectedRequest)}
                className="bg-amber-500 hover:bg-amber-400 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Approve & Teruskan ke Admin
              </button>
              <button onClick={() => handleReject(selectedRequest)}
                className="bg-white/20 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5">
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                Tolak
              </button>
            </>
          )}
          {/* Approve/Tolak: hanya admin/superadmin, terkunci selama masih internal_review */}
          {bisaKelolaRequest && detailIsPending && selectedRequest.routing_status !== 'internal_review' && (
            <>
              <button onClick={() => { setAssignModal({ open: true, req: selectedRequest, roomIdx: 0 }); }}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Approve & Assign PTS
              </button>
              <button onClick={() => handleReject(selectedRequest)}
                className="bg-white/20 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5">
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                Tolak
              </button>
            </>
          )}
          {/* Supervisor yang di-route: wajib assign lanjut ke Tim PTS (atau sendiri) */}
          {selectedRequest?.routing_status === 'supervisor_assign' && selectedRequest?.assigned_supervisor_id === currentUser.id && (
            <button onClick={() => { setAssignModal({ open: true, req: selectedRequest, roomIdx: 0 }); }}
              className="bg-amber-500 hover:bg-amber-400 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
              <IkonTeks nama="🎯" />Assign ke Tim
            </button>
          )}
          {/* Info untuk PTS yang di-assign: tombol mulai in_progress */}
          {isTeamPTS && detailRoomStatus === 'approved' && detailRoomAssignName === currentUser.full_name && (
            <button onClick={() => handleStatusUpdate(selectedRequest, 'in_progress', detailRoomIdx)}
              className="bg-blue-500 hover:bg-blue-400 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Mulai In Progress
            </button>
          )}
          {/* Status update: admin/superadmin/Full Access, atau PTS yang di-assign */}
          {isPTS && !detailIsPending && (bisaKelolaRequest || detailRoomAssignName === currentUser.full_name) && (
            <button onClick={() => { setSelectedNewStatus(''); setStatusUpdateModal({ open: true, req: selectedRequest, roomIdx: detailRoomIdx }); }}
              className="bg-blue-500 hover:bg-blue-400 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Update Status
            </button>
          )}
          {bisaKelolaRequest && bolehRerouteRequest(selectedRequest) && (
            <button onClick={() => { setRerouteTarget(selectedRequest); setRerouteTo(''); }}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
              <IkonTeks nama="🔀" />Re-route
            </button>
          )}
          {bolehEditRequest(selectedRequest) && selectedRequest.status !== 'rejected' && (
            <button onClick={handleOpenEditForm}
              className="bg-amber-400 hover:bg-amber-300 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5">
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit
            </button>
          )}
          {bisaKelolaRequest && (
            <button onClick={() => { setDeleteModal({ open: true, req: selectedRequest }); setDeleteConfirmText(''); }}
              className="bg-white/10 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5">
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Hapus
            </button>
          )}
          <button onClick={async () => {
            if (!selectedRequest) return;
            setDownloadingPackage(true);
            try {
              await unduhPaketRequest({
                selectedRequest,
                attachments,
                ccLabel: getCCLabel(selectedRequest),
                notify,
                desain3d: desain3dTools,
              });
            } finally {
              setDownloadingPackage(false);
            }
          }} disabled={downloadingPackage}
            className="bg-white/20 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5 disabled:opacity-60">
            {downloadingPackage ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            {downloadingPackage ? 'Menyiapkan...' : 'Download .zip'}
          </button>
          <button onClick={() => cetakRequest(selectedRequest, getCCLabel(selectedRequest), desain3dTools)}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </button>
        </div>
      </div>
    </>
  );
}
