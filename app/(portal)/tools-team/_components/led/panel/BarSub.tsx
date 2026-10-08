'use client';
/** Tab sub menu LED Videotron: Calculator LED, Screen Connection, Power Connection. */
import { Cable, Calculator, Zap } from 'lucide-react';
import type { AlatLED } from './alat';

export type SubLED = 'led' | 'koneksi' | 'daya';
export const SUB_LED: { v: SubLED; l: string; Ikon: typeof Calculator }[] = [
  { v: 'led', l: 'Calculator LED', Ikon: Calculator }, { v: 'koneksi', l: 'Screen Connection', Ikon: Cable }, { v: 'daya', l: 'Power Connection', Ikon: Zap },
];

export function BarSub({ a }: { a: AlatLED }) {
  const { pindah, tampilan } = a.K;
  return (
    <>
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 w-fit max-w-full overflow-x-auto print:hidden" role="tablist" aria-label="Sub menu LED Videotron">
        {SUB_LED.map(({ v, l, Ikon: IkonSub }) => {
          const on = tampilan === v;
          return (
            <button key={v} type="button" role="tab" aria-selected={on} onClick={() => pindah(v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap ${on ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}>
              <IkonSub size={15} /> {l}
            </button>
          );
        })}
      </div>
    </>
  );
}
