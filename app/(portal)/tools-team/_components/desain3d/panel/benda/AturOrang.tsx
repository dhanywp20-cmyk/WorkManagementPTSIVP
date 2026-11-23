'use client';
import { Angka } from '../../../bersama/ui';
import { namaOrangOtomatis, PRESET_TINGGI_ORANG, TINGGI_ORANG_MAKS, TINGGI_ORANG_MIN, tinggiOrangSah, ukuranOrang } from '../../inti/orang';
import type { KonteksAtur } from './konteks';

export function AturOrang({ c }: { c: KonteksAtur }) {
  const { b, label, set } = c;
  if (b.jenis !== 'orang') return null;
  const cm = Math.round(tinggiOrangSah(b.h) * 100);
  const ubah = (m: number) => {
    const u = ukuranOrang(m);
    set({ h: u.h, w: u.w, d: u.d, ...(namaOrangOtomatis(b.nama) ? { nama: u.nama } : {}) });
  };
  return (
    <div className="space-y-2">
      <Angka label="Tinggi orang" satuan="cm" step={1} nilai={cm}
        onUbah={v => v >= TINGGI_ORANG_MIN * 100 && v <= TINGGI_ORANG_MAKS * 100 && ubah(v / 100)} />
      <div>
        <span className={label}>Cepat</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TINGGI_ORANG.map(t => {
            const on = Math.round(t * 100) === cm;
            return (
              <button key={t} type="button" onClick={() => ubah(t)} aria-pressed={on}
                className={`px-2.5 py-1 rounded-lg border text-[12px] font-bold ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {Math.round(t * 100)} cm
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11.5px] text-slate-500">Untuk skala & cek pandangan: lebar dan tebal tubuh ikut menyesuaikan tinggi. Warna baju bisa diganti di tab Tampilan.</p>
    </div>
  );
}
