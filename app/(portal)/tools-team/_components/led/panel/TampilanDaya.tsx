'use client';
import { useState } from 'react';
import { bukaCetak, namaBerkas, unduhLembarPNG } from '../../bersama/cetak';
import { TombolSalin } from '../../bersama/ui';
import { RuangDaya } from '../daya/RuangDaya';
import { BarSub } from './BarSub';
import { KartuLayar } from './KartuLayar';
import { ModalBersama } from './ModalBersama';
import type { AlatLED } from './alat';

export function TampilanDaya({ a }: { a: AlatLED }) {
  const { customer, dayaLED, labelLED, layarDaya, project, setDayaLED, sirkuitTotal } = a.K;
  const { lembarDaya, namaFile, teksDaya } = a.E;
  const [pilih, setPilih] = useState(0);
  const aktif = Math.min(pilih, layarDaya.length - 1);
  return (
    <>
      <div className="space-y-4">
        <BarSub a={a} />
        <KartuLayar a={a} judul="Power Connection"><TombolSalin key="salin" teks={teksDaya} onCetak={() => bukaCetak(lembarDaya())}
          onPng={() => unduhLembarPNG(lembarDaya(), namaBerkas('Power Connection', labelLED, project, customer))} /></KartuLayar>
        {layarDaya.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Pilih screen">
              {layarDaya.map((l, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === aktif} onClick={() => setPilih(i)}
                  className={`px-3 py-1.5 rounded-xl text-[12.5px] font-bold whitespace-nowrap ${i === aktif ? 'bg-amber-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                  {l.nama} <span className={`font-semibold ${i === aktif ? 'text-white/85' : 'text-slate-500'}`}>{l.d.kolom}×{l.d.baris}</span>
                </button>
              ))}
            </div>
            <span className="text-[12px] text-slate-600">Pengaturan sirkuit berlaku untuk semua screen · total {sirkuitTotal} sirkuit × MCB {dayaLED.mcb} A</span>
          </div>
        )}
        <RuangDaya d={layarDaya[aktif].d} s={dayaLED} onUbah={setDayaLED} namaFile={layarDaya.length > 1 ? `${namaFile} - ${layarDaya[aktif].nama}` : namaFile} />
        <ModalBersama a={a} />
      </div>
    </>
  );
}
