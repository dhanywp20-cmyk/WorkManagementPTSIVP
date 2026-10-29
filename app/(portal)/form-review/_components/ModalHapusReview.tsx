'use client';

/** ModalHapusReview - hapus satu review (ketik HAPUS). Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { KotakInfo, Modal, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';
import { ReviewForm } from './shared';

export interface ModalHapusReviewProps {
  deleteConfirmText: string;
  deleteTarget: ReviewForm | null;
  handleDelete: () => Promise<void>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteTarget: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
  setShowDeleteModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showDeleteModal: boolean;
}

export function ModalHapusReview({ deleteConfirmText, deleteTarget, handleDelete, setDeleteConfirmText, setDeleteTarget, setShowDeleteModal, showDeleteModal }: ModalHapusReviewProps) {
  if (!showDeleteModal || !deleteTarget) return null;
  const batal = () => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteConfirmText(''); };
  return (
    <Modal buka onTutup={batal} judul="Hapus Review" keterangan={`${deleteTarget.project_name} · ${deleteTarget.review_category}`} lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={batal}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => { void handleDelete(); }} disabled={deleteConfirmText !== 'HAPUS'}>Hapus Permanen</TombolModal>
      </>}>
      <div className="space-y-4">
        <KotakInfo nada="bahaya"><strong>Tindakan ini tidak dapat dibatalkan.</strong> Review ini dihapus permanen dari database.</KotakInfo>
        <div>
          <label htmlFor="f-form-review-page-1" className="block text-xs font-bold text-slate-700 mb-1.5">
            Ketik <span className="font-mono bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-sm">HAPUS</span> untuk konfirmasi
          </label>
          <input id="f-form-review-page-1" type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Ketik HAPUS di sini..." className={kelasIsian} />
        </div>
      </div>
    </Modal>
  );
}
