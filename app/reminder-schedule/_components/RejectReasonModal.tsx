'use client';
import { ModalPortal } from '@/components/shared';
import type { Reminder } from './shared';

/**
 * Modal "Tolak Request" dengan alasan - dipakai DUA alur yang tadinya
 * masing² punya salinan JSX identik di page.tsx: Sales Internal menolak
 * (internalReject*) dan Admin/Manager menolak di tahap admin_review
 * (adminReject*). Satu komponen, dipanggil dua kali dengan
 * state/handler berbeda - bukan dua salinan kode yang sama.
 */
export function RejectReasonModal({
  target, reason, setReason, saving, onConfirm, onCancel,
}: {
  target: Reminder;
  reason: string;
  setReason: (v: string) => void;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(220,38,38,0.35)' }}>
          <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            <h3 className="text-lg font-bold text-white">❌ Tolak Request</h3>
            <p className="text-red-100/90 text-xs mt-0.5 truncate">{target.project_name}</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Alasan Penolakan *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                rows={3} placeholder="Tuliskan alasan penolakan..."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none focus:ring-2 focus:ring-red-500/40"
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>Batal</button>
              <button onClick={onConfirm} disabled={saving}
                className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                ❌ Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
