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
      className="fixed inset-0 z-2000 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      <div
        ref={badan}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        aria-describedby={state.description ? `${idJudul}-rincian` : undefined}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 outline-hidden"
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
