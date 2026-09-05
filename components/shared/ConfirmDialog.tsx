'use client';
import { useEffect, useId, useRef } from 'react';
import { ModalPortal } from './ModalPortal';
import { tumpukan, kunciGulir, FOCUSABLE_SELECTOR } from './Modal';

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
  const idJudul = useId();
  const badan = useRef<HTMLDivElement>(null);
  const buka = !!state;

  // Ikut tumpukan+kunci-gulir yang sama dengan Modal - dialog ini sering
  // dibuka DARI DALAM modal (mis. konfirmasi hapus di atas form Project
  // Progress), jadi Esc dan kunci gulir harus dihitung lintas keduanya,
  // bukan masing-masing menyimpan hitungannya sendiri.
  useEffect(() => {
    if (!buka) return;
    tumpukan.push(idJudul);
    const lepasKunci = kunciGulir();
    return () => {
      const i = tumpukan.lastIndexOf(idJudul);
      if (i !== -1) tumpukan.splice(i, 1);
      lepasKunci();
    };
  }, [buka, idJudul]);

  useEffect(() => {
    if (buka) badan.current?.focus();
  }, [buka]);

  // Esc membatalkan, dan jebakan fokus mengunci Tab di dalam dialog -
  // keduanya cuma aktif kalau dialog ini yang paling atas di tumpukan.
  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => {
      if (tumpukan[tumpukan.length - 1] !== idJudul) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const kontainer = badan.current;
      if (!kontainer) return;
      const focusable = Array.from(
        kontainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        kontainer.focus();
        return;
      }
      const pertama = focusable[0];
      const terakhir = focusable[focusable.length - 1];
      const aktif = document.activeElement;
      if (e.shiftKey) {
        if (aktif === pertama || aktif === kontainer) {
          e.preventDefault();
          terakhir.focus();
        }
      } else if (aktif === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    };
    document.addEventListener('keydown', tekan);
    return () => document.removeEventListener('keydown', tekan);
  }, [buka, onCancel, idJudul]);

  if (!state) return null;
  return (
    <ModalPortal>
    <div role="dialog" aria-modal="true"
      // Z.blocking (2000) - WAJIB di atas SELURUH lapisan overlay, karena
      // dialog ini dipanggil dari dalam modal bertingkat (mis. detail Project
      // Progress di Z.overlay, assign di Z.overlayTop). Kalau lebih rendah,
      // konfirmasinya ter-render tapi tertutup total: klik user jatuh ke modal
      // di belakangnya dan terasa seperti tombolnya tidak berfungsi.
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      {/* role="alertdialog": ini pertanyaan yang MENUNGGU jawaban, bukan
          sekadar panel. Penandanya membuat pembaca layar mengumumkan
          pertanyaannya begitu muncul, bukan menunggu user menemukannya. */}
      <div
        ref={badan}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        aria-describedby={state.description ? `${idJudul}-rincian` : undefined}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl" aria-hidden="true">{state.danger ? '🗑️' : '❓'}</span>
          <div>
            <p id={idJudul} className="font-semibold text-gray-800 leading-snug">{state.message}</p>
            {state.description && (
              <p id={`${idJudul}-rincian`} className="text-sm text-gray-500 mt-1">{state.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            Batal
          </button>
          <button
            type="button"
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
