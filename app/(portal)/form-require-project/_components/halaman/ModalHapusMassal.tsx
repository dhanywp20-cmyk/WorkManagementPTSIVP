'use client';

/** ModalHapusMassal - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { supabase } from '@/lib/supabase';
import { ProjectRequest } from '../shared';

export interface ModalHapusMassalProps {
  bulkConfirm: boolean;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedIds: Set<string>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBulkDeleting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRequests: import("react").Dispatch<import("react").SetStateAction<ProjectRequest[]>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
}

export function ModalHapusMassal({ bulkConfirm, notify, selectedIds, setBulkConfirm, setBulkDeleting, setRequests, setSelectMode, setSelectedIds }: ModalHapusMassalProps) {
  return (
    <>
      {bulkConfirm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: Z.overlay }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-linear-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl"><Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div><h3 className="font-bold text-white">Hapus {selectedIds.size} Request?</h3>
              <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{selectedIds.size} request project</strong> yang dipilih secara permanen.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkConfirm(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button onClick={async () => {
                  setBulkConfirm(false); setBulkDeleting(true);
                  const { error } = await supabase.from('project_requests').delete().in('id', Array.from(selectedIds));
                  if (!error) { setRequests(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
                  else notify('error', 'Gagal: ' + error.message);
                  setBulkDeleting(false);
                }} className="flex-2 bg-linear-to-r from-red-600 to-red-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm hover:from-red-700 hover:to-red-800">
                  <IkonTeks nama="🗑" />Ya, Hapus Permanen
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
