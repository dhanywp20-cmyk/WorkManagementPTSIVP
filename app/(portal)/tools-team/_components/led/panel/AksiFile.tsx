'use client';
/** Tombol buka / simpan hitungan & undo-redo. */
import { FolderOpen, Redo2, Save, Undo2 } from 'lucide-react';
import type { AlatLED } from './alat';

export function AksiFile({ a }: { a: AlatLED }) {
  const { hanyaLihat, riwayat, setFileMode } = a.K;
  return (
    <>
      <div className="flex items-center gap-1 print:hidden">
        <button type="button" onClick={() => setFileMode('buka')} title="Buka hitungan tersimpan"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"><FolderOpen size={14} /> Buka</button>
        {!hanyaLihat && (
          <button type="button" onClick={() => setFileMode('simpan')} title="Simpan hitungan untuk tim (termasuk screen connection)"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"><Save size={14} /> Simpan</button>
        )}
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Undo dan redo">
          <button type="button" onClick={riwayat.undo} disabled={!riwayat.bisaUndo} title="Undo (Ctrl+Z)" aria-label="Undo"
            className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"><Undo2 size={14} /></button>
          <button type="button" onClick={riwayat.redo} disabled={!riwayat.bisaRedo} title="Redo (Ctrl+Y)" aria-label="Redo"
            className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 border-l border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"><Redo2 size={14} /></button>
        </div>
      </div>
    </>
  );
}
