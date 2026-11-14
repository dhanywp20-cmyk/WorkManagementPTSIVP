'use client';
import { KalkulatorAudio } from './av/KalkulatorAudio';
import { KalkulatorDaya } from './av/KalkulatorDaya';
import { KalkulatorDisplay } from './av/KalkulatorDisplay';
import { KalkulatorLayar } from './av/KalkulatorLayar';
import { KalkulatorPoE } from './av/KalkulatorPoE';
import { KalkulatorProyektor } from './av/KalkulatorProyektor';
import { KalkulatorRak } from './av/KalkulatorRak';
import { KalkulatorSinyal } from './av/KalkulatorSinyal';
import { Ikon } from '@/components/shared/Ikon';
import { useState } from 'react';

const KUNCI = 'wm_kalkulator_av_sub';
const subAwal = () => { try { const v = localStorage.getItem(KUNCI); return SUB_AV.some(x => x.k === v) ? v! : 'layar'; } catch { return 'layar'; } };

const SUB_AV = [
  { k: 'layar', judul: 'Ukuran Layar', ikon: '📐', C: KalkulatorLayar },
  { k: 'display', judul: 'Videowall & IFP', ikon: '🖥', C: KalkulatorDisplay },
  { k: 'proyektor', judul: 'Proyektor', ikon: '📽', C: KalkulatorProyektor },
  { k: 'sinyal', judul: 'Bandwidth Sinyal', ikon: '〰', C: KalkulatorSinyal },
  { k: 'audio', judul: 'Audio', ikon: '🔊', C: KalkulatorAudio },
  { k: 'daya', judul: 'Daya & Panas', ikon: '⚡', C: KalkulatorDaya },
  { k: 'rak', judul: 'Rak', ikon: '🗄', C: KalkulatorRak },
  { k: 'poe', judul: 'PoE', ikon: '🔌', C: KalkulatorPoE },
] as const;

export function KalkulatorAV() {
  const [aktif, setAktifState] = useState<string>(subAwal);
  const [dibuka, setDibuka] = useState<string[]>([aktif]);
  if (!dibuka.includes(aktif)) setDibuka([...dibuka, aktif]);
  const setAktif = (k: string) => { setAktifState(k); try { localStorage.setItem(KUNCI, k); } catch { return; } };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 w-fit max-w-full overflow-x-auto print:hidden" role="tablist" aria-label="Kalkulator AV">
        {SUB_AV.map(x => {
          const on = x.k === aktif;
          return (
            <button key={x.k} type="button" role="tab" aria-selected={on} onClick={() => setAktif(x.k)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap ${on ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}>
              <Ikon nama={x.ikon} ukuran={14} /> {x.judul}
            </button>
          );
        })}
      </div>
      {SUB_AV.filter(x => dibuka.includes(x.k)).map(x => <section key={x.k} hidden={x.k !== aktif} aria-label={x.judul}><x.C /></section>)}
    </div>
  );
}
