'use client';
import { hurufSah } from '@/lib/sld/dok';
import { Angka, Isian, kelasKecil, kelasTombol } from './isian';

export const PT_PER_MM = 72 / 25.4;
const bulat = (v: number) => Math.round(v * 2) / 2;

export function IsianPt({ label, mm, onUbah, min = 3, maks = 56, bantuan, reset }: {
  label: string; mm: number; onUbah: (mm: number) => void; min?: number; maks?: number; bantuan?: string; reset?: () => void;
}) {
  const pt = bulat(mm * PT_PER_MM);
  const atur = (v: number) => onUbah(Math.min(maks, Math.max(min, v)) / PT_PER_MM);
  return (
    <Isian label={label} bantuan={bantuan}>
      <div className="flex items-center gap-1.5">
        <button type="button" className={`${kelasTombol} !px-2.5`} onClick={() => atur(pt - 0.5)} aria-label="Perkecil huruf">A−</button>
        <Angka nilai={pt} min={min} maks={maks} langkah={0.5} onUbah={atur} className={`${kelasKecil} !w-20`} label={`${label} (pt)`} />
        <span className="text-[12px] text-slate-500">pt</span>
        <button type="button" className={`${kelasTombol} !px-2.5`} onClick={() => atur(pt + 0.5)} aria-label="Perbesar huruf">A+</button>
        {reset && <button type="button" className={kelasTombol} onClick={reset}>Bawaan</button>}
      </div>
    </Isian>
  );
}

export function IsianHurufLabel({ label, dasarMm, faktor, bawaan = 1, onUbah, bantuan }: {
  label: string; dasarMm: number; faktor?: number; bawaan?: number; onUbah: (f: number | undefined) => void; bantuan?: string;
}) {
  return (
    <IsianPt label={label} mm={dasarMm * (faktor ?? bawaan)} bantuan={bantuan} min={bulat(dasarMm * PT_PER_MM * 0.5)} maks={bulat(dasarMm * PT_PER_MM * 3)}
      onUbah={mm => onUbah(hurufSah(mm / dasarMm))} reset={faktor !== undefined ? () => onUbah(undefined) : undefined} />
  );
}
