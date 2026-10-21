'use client';

/** ModalUpdateStatus - ubah status request / ruangan. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { Modal, TombolModal } from '@/components/shared';
import { User, ProjectRequest, getRoomStatus, getRoomAssignName, statusConfig } from './shared';

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
  if (!statusUpdateModal.open || !statusUpdateModal.req) return null;
  const req = statusUpdateModal.req;
  const tutup = () => setStatusUpdateModal({ open: false, req: null, roomIdx: 0 });
  //  Pilihan status memakai label & warna status yang sama dengan daftar (statusConfig), bukan peta warna sendiri.
  const pilihan = ['pending', 'in_progress', 'completed', ...(bisaKelolaRequest ? ['approved', 'rejected'] : [])].filter(v => {
    if (v === getRoomStatus(req, statusUpdateModal.roomIdx)) return false;
    //  in_progress hanya bisa diset oleh PTS yang ditugaskan (atau admin)
    if (v === 'in_progress' && !canSetInProgress(req, statusUpdateModal.roomIdx)) return false;
    //  completed hanya admin/superadmin atau PTS yang ditugaskan
    if (v === 'completed' && isTeamPTS && getRoomAssignName(req, statusUpdateModal.roomIdx) !== currentUser.full_name) return false;
    return true;
  });
  return (
    <Modal buka onTutup={tutup} judul="Update Status" keterangan={req.project_name} ukuran="sm" lapisan="atas"
      footer={<>
        <TombolModal onClick={tutup}>Batal</TombolModal>
        <TombolModal jenis="utama" disabled={!selectedNewStatus} onClick={async () => {
          if (!selectedNewStatus) return;
          await handleStatusUpdate(req, selectedNewStatus, statusUpdateModal.roomIdx);
          tutup();
          setSelectedNewStatus('');
        }}>Update Status</TombolModal>
      </>}>
      <p className="text-xs font-bold text-slate-700 mb-2">Pilih status baru</p>
      <div className="space-y-2" role="radiogroup">
        {pilihan.map(v => {
          const sc = statusConfig[v as keyof typeof statusConfig];
          const dipilih = selectedNewStatus === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={dipilih} onClick={() => setSelectedNewStatus(v)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-kontrol border text-left transition-all text-sm font-semibold ${dipilih ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${dipilih ? 'border-slate-800' : 'border-slate-300'}`}>
                {dipilih && <span className="w-2 h-2 rounded-full bg-slate-800" />}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${sc?.color ?? ''} ${sc?.bg ?? ''} ${sc?.border ?? ''}`}>{sc?.label ?? v}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
