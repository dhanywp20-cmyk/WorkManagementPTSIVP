'use client';

/** ModalHapusReview - dipecah dari app/(portal)/form-review/_components/FormReviewPageInner.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
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
  return (
    <>
      {showDeleteModal && deleteTarget && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6"
            style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(220,38,38,0.5)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl"><Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Hapus Review</h3>
                <p className="text-xs font-medium text-gray-500">{deleteTarget.project_name}</p>
                <p className="text-xs text-gray-500">{deleteTarget.review_category}</p>
              </div>
            </div>
            <div className="rounded-xl p-3 mb-4 text-xs"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#b91c1c' }}>
              <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> <strong>Tindakan ini tidak dapat dibatalkan.</strong> Review ini akan dihapus permanen dari database.
            </div>
            <div className="mb-4">
              <label htmlFor="f-form-review-page-1" className="block text-sm font-bold mb-1 text-gray-700">
                Ketik <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">HAPUS</span> untuk konfirmasi
              </label>
              <input id="f-form-review-page-1" type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Ketik HAPUS di sini..."
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                style={{ border: '2px solid rgba(220,38,38,0.3)', background: 'white' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleDelete} disabled={deleteConfirmText !== 'HAPUS'}
                className="bg-gradient-to-r from-red-600 to-red-800 text-white py-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <IkonTeks nama="🗑" />Hapus Permanen
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteConfirmText(''); }}
                className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">
                ✕ Batal
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
