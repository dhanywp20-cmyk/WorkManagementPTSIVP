'use client';
import { KalkulatorAudio } from './av/KalkulatorAudio';
import { KalkulatorDaya } from './av/KalkulatorDaya';
import { KalkulatorLayar } from './av/KalkulatorLayar';
import { KalkulatorProyektor } from './av/KalkulatorProyektor';
import { KalkulatorSinyal } from './av/KalkulatorSinyal';
import { Ikon } from '@/components/shared/Ikon';
import { useState } from 'react';

/**
 * Kalkulator AV (ukuran layar, proyektor, bandwidth sinyal, audio, daya & panas). Rumus di
 * lib/av-hitung.ts; tiap hasil bisa disalin, dicetak (lembar A4), dan diunduh PNG.
 */

/** Menu Kalkulator AV: lima kalkulator dalam satu alat (sub menu). */
const SUB_AV = [
  { k: 'layar', judul: 'Ukuran Layar', ikon: '📐', C: KalkulatorLayar },
  { k: 'proyektor', judul: 'Proyektor', ikon: '📽', C: KalkulatorProyektor },
  { k: 'sinyal', judul: 'Bandwidth Sinyal', ikon: '〰', C: KalkulatorSinyal },
  { k: 'audio', judul: 'Audio', ikon: '🔊', C: KalkulatorAudio },
  { k: 'daya', judul: 'Daya & Panas', ikon: '⚡', C: KalkulatorDaya },
] as const;

export function KalkulatorAV() {
  const [aktif, setAktif] = useState<string>('layar');
  const C = SUB_AV.find(x => x.k === aktif)?.C ?? KalkulatorLayar;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 w-fit max-w-full overflow-x-auto print:hidden" role="tablist" aria-label="Kalkulator AV">
        {SUB_AV.map(x => {
          const on = x.k === aktif;
          return (
            <button key={x.k} type="button" role="tab" aria-selected={on} onClick={() => setAktif(x.k)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap ${on ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}>
              <Ikon nama={x.ikon} ukuran={14} /> {x.judul}
            </button>
          );
        })}
      </div>
      <C />
    </div>
  );
}
