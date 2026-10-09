'use client';

/** ModalHapusRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { ProjectRequest } from './shared';

export interface ModalHapusRequestProps {
  deleteConfirmText: string;
  deleteModal: { open: boolean; req: ProjectRequest | null; };
  deleting: boolean;
  handleDeleteConfirm: () => Promise<void>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
}

export function ModalHapusRequest({ deleteConfirmText, deleteModal, deleting, handleDeleteConfirm, setDeleteConfirmText, setDeleteModal }: ModalHapusRequestProps) {
  return (
    <>
      {deleteModal.open && deleteModal.req && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: Z.overlayTop }}>
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg aria-hidden="true" focusable="false" className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base">Hapus Ticket</h3>
                  <p className="text-sm text-gray-500 mt-0.5 font-medium truncate">{deleteModal.req.project_name}</p>
                  <p className="text-xs text-gray-500 truncate">{deleteModal.req.requester_name}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5 mb-5">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p className="text-xs font-semibold text-amber-700">Tidak bisa dibatalkan - activity log &amp; overdue setting ikut terhapus.</p>
              </div>
              <div className="mb-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Ketik <span className="text-red-500 font-black tracking-widest">HAPUS</span> untuk konfirmasi</p>
                <input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS di sini..."
                  autoFocus
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder-gray-300"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteConfirm()}
                  disabled={deleteConfirmText !== 'HAPUS' || deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: deleteConfirmText === 'HAPUS' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '#e5e7eb', color: deleteConfirmText === 'HAPUS' ? 'white' : '#9ca3af' }}>
                  {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menghapus...</> : <>
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hapus Permanen
                  </>}
                </button>
                <button onClick={() => { setDeleteModal({ open: false, req: null }); setDeleteConfirmText(''); }} disabled={deleting}
                  className="px-5 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50 border border-gray-200">
                  × Batal
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
