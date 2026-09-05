'use client';
import { ModalPortal } from '@/components/shared';

/**
 * Konfirmasi hapus massal - dipindah dari app/reminder-schedule/page.tsx
 * apa adanya (JSX identik). State & handler tetap di page.tsx, komponen
 * ini murni presentasional.
 */
export function BulkDeleteConfirmModal({
  jumlah, onCancel, onConfirm,
}: {
  jumlah: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">🗑️</span>
            <div><h3 className="font-bold text-white">Hapus {jumlah} Jadwal?</h3>
            <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p></div>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{jumlah} jadwal</strong> yang dipilih secara permanen dari sistem.</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
              <button onClick={onConfirm} className="flex-[2] bg-gradient-to-r from-red-600 to-red-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm hover:from-red-700 hover:to-red-800">
                🗑️ Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
