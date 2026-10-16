'use client';

/** ModalTolakRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { IkonTeks } from '@/components/shared/Ikon';
import { ProjectRequest } from '../shared';

export interface ModalTolakRequestProps {
  handleRejectConfirm: () => Promise<void>;
  rejectModal: { open: boolean; req: ProjectRequest | null; };
  rejectNote: string;
  rejectSaving: boolean;
  setRejectModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
  setRejectNote: import("react").Dispatch<import("react").SetStateAction<string>>;
}

export function ModalTolakRequest({ handleRejectConfirm, rejectModal, rejectNote, rejectSaving, setRejectModal, setRejectNote }: ModalTolakRequestProps) {
  return (
    <>
      {rejectModal.open && rejectModal.req && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: Z.overlayTop }}>
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-md w-full border-2 border-red-400 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-700 px-6 py-4">
              <h3 className="font-bold text-white text-lg"><IkonTeks nama="❌" />Tolak Request</h3>
              <p className="text-red-100 text-xs mt-0.5">{rejectModal.req.project_name}</p>
            </div>
            <div className="p-6">
              <label htmlFor="f-form-require-project-page-1" className="block text-sm font-bold text-gray-700 mb-2">Alasan penolakan <span className="text-red-500">*</span></label>
              <textarea id="f-form-require-project-page-1" value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Tuliskan alasan penolakan..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 transition-all outline-none resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setRejectModal({ open: false, req: null })} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">Batal</button>
                <button onClick={handleRejectConfirm} disabled={rejectSaving} className="flex-[2] bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">{rejectSaving ? '⏳...' : '❌ Ya, Tolak'}</button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
