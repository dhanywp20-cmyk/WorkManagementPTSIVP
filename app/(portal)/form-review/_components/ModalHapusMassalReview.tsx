'use client';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { ModalPortal, KepalaModal } from '@/components/shared';
import { ReviewForm, GuestUser } from './shared';

export function ModalHapusMassalReview({ selectedIds, setSelectedIds, setBulkConfirm, setBulkDeleting, setSelectMode, setReviews, currentUser, notify }: {
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setBulkConfirm: (v: boolean) => void;
  setBulkDeleting: (v: boolean) => void;
  setSelectMode: (v: boolean) => void;
  setReviews: Dispatch<SetStateAction<ReviewForm[]>>;
  currentUser: GuestUser | null;
  notify: (type: 'success' | 'error', msg: string) => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1000 p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-kartu shadow-modal max-w-sm w-full overflow-hidden">
          <KepalaModal judul={`Hapus ${selectedIds.size} Review?`} keterangan="Tindakan ini tidak dapat dibatalkan." onTutup={() => setBulkConfirm(false)} />
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{selectedIds.size} review</strong> yang dipilih secara permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setBulkConfirm(false)} className="tombol-kedua flex-1 py-2.5 rounded-kontrol font-bold text-sm">Batal</button>
              <button onClick={async () => {
                setBulkConfirm(false); setBulkDeleting(true);
                const { error } = await supabase.from('form_reviews').delete().in('id', Array.from(selectedIds));
                if (!error) {
                  void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.username ?? '', action: 'delete', module: 'form-review', notes: `Bulk delete ${selectedIds.size} review` });
                  setReviews(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false);
                }
                else notify('error', 'Gagal: ' + error.message);
                setBulkDeleting(false);
              }} className="tombol-bahaya flex-2 py-2.5 rounded-kontrol font-bold text-sm">
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
