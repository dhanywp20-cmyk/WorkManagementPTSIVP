'use client';
import { Redo2, Undo2 } from 'lucide-react';
import { BilahFile } from '../../bersama/berkas/BilahFile';
import type { AlatLED } from './alat';

export function AksiFile({ a }: { a: AlatLED }) {
  const { berkas, riwayat } = a.K;
  return (
    <div className="flex flex-wrap items-center gap-1 print:hidden">
      <BilahFile b={berkas} />
      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Undo dan redo">
        <button type="button" onClick={riwayat.undo} disabled={!riwayat.bisaUndo} title="Undo (Ctrl+Z)" aria-label="Undo"
          className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"><Undo2 size={14} /></button>
        <button type="button" onClick={riwayat.redo} disabled={!riwayat.bisaRedo} title="Redo (Ctrl+Y)" aria-label="Redo"
          className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 border-l border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"><Redo2 size={14} /></button>
      </div>
    </div>
  );
}
