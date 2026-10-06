'use client';
/** Atur lampu plafon: tipe, lumen, sudut sinar, dimmer, suhu warna, lux langsung. */
import { Angka, f, Pilih } from '../../../ui';
import { bendaBaru, lumenLampu, luxLampuLangsung, type Ruang, SPEK_LAMPU, sudutLampuDari, type TipeLampu } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturLampu({ c }: { c: KonteksAtur }) {
  const { b, kosong, onUbah, plafon, set } = c;
  return (
    <>
      {b.jenis === 'lampu' && (() => {
        const tipe = b.tipeLampu ?? 'downlight';
        const bawahLampu = luxLampuLangsung(b, { p: 0, l: 0, t: plafon, lantai: 'kayu', r2: null } as Ruang, [b.x, 0.75, b.z], [0, 1, 0]);
        return (
          <div className="rounded-xl border border-amber-200 p-2.5 space-y-2 bg-amber-50/40">
            <Pilih label="Tipe lampu" nilai={tipe} onUbah={(v: TipeLampu) => {
              const baru = bendaBaru('lampu', kosong, { tipeLampu: v });
              const namaBawaan = Object.values(SPEK_LAMPU).some(sp => b.nama.startsWith(sp.label)) || b.nama.startsWith('Lampu');
              onUbah({ ...b, tipeLampu: v, w: baru.w, h: baru.h, d: baru.d, lumen: baru.lumen, sudutLampu: baru.sudutLampu, gantungLampu: baru.gantungLampu,
                elev: Math.max(0.5, plafon - baru.h - (baru.gantungLampu ?? 0)), nama: namaBawaan ? baru.nama : b.nama });
            }} opsi={(Object.keys(SPEK_LAMPU) as TipeLampu[]).map(k => ({ v: k, l: `${SPEK_LAMPU[k].label} · ${SPEK_LAMPU[k].lumen} lm · ${SPEK_LAMPU[k].sudut}°` }))} />
            <div className="grid grid-cols-2 gap-2">
              <Angka label="Lumen" nilai={lumenLampu(b)} satuan="lm" step={100} onUbah={v => v >= 0 && v <= 50000 && set({ lumen: Math.round(v) })} />
              <Angka label="Sudut sinar" nilai={sudutLampuDari(b)} satuan="°" step={5} onUbah={v => v >= 10 && v <= 160 && set({ sudutLampu: v })} />
              <Angka label="Dimmer" nilai={b.dimmer ?? 100} satuan="%" step={5} onUbah={v => v >= 0 && v <= 100 && set({ dimmer: Math.round(v) })} />
              <Pilih label="Suhu warna" nilai={b.kelvin ?? 4000} onUbah={v => set({ kelvin: v })}
                opsi={[{ v: 3000, l: '3000 K hangat' }, { v: 4000, l: '4000 K netral' }, { v: 6500, l: '6500 K daylight' }]} />
            </div>
            {SPEK_LAMPU[tipe].gantung > 0 && (
              <Angka label="Gantung dari plafon" nilai={b.gantungLampu ?? SPEK_LAMPU[tipe].gantung} satuan="m" step={0.05}
                onUbah={v => v >= 0 && v <= 3 && set({ gantungLampu: v, elev: Math.max(0.5, plafon - b.h - v) })} />
            )}
            <p className="text-[12px] text-slate-600">Tepat di bawah lampu, di meja (0,75 m): ±{f(bawahLampu, 0)} lux langsung (dimmer lampu ini; tanpa pantulan & dimmer ruangan). Isi lumen & sudut sinar sesuai datasheet.</p>
          </div>
        );
      })()}
    </>
  );
}
