'use client';
import { ModalPortal } from './ModalPortal';

export interface ConfirmState {
  message: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  state,
  onCancel,
}: {
  state: ConfirmState | null;
  onCancel: () => void;
}) {
  if (!state) return null;
  return (
    <ModalPortal>
    <div
      // Z.blocking (2000) — WAJIB di atas SELURUH lapisan overlay, karena
      // dialog ini dipanggil dari dalam modal bertingkat (mis. detail Project
      // Progress di Z.overlay, assign di Z.overlayTop). Kalau lebih rendah,
      // konfirmasinya ter-render tapi tertutup total: klik user jatuh ke modal
      // di belakangnya dan terasa seperti tombolnya tidak berfungsi.
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">{state.danger ? '🗑️' : '❓'}</span>
          <div>
            <p className="font-semibold text-gray-800 leading-snug">{state.message}</p>
            {state.description && (
              <p className="text-sm text-gray-500 mt-1">{state.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            Batal
          </button>
          <button
            onClick={() => { state.onConfirm(); onCancel(); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition ${
              state.danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {state.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
