'use client';
/** Atur kamera & paperless lift. */
import { Segmen } from '../../../ui';
import { bendaBaru, type TipeKamera } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturKonferensi({ c }: { c: KonteksAtur }) {
  const { b, kosong, onUbah, set } = c;
  return (
    <>
      {b.jenis === 'kamera' && (
        <Segmen label="Tipe kamera" nilai={b.tipeKamera ?? 'ptz'} onUbah={(v: TipeKamera) => {
          const baru = bendaBaru('kamera', kosong, { tipeKamera: v });
          const namaBawaan = ['Kamera', 'Kamera PTZ', 'Kamera PTZ AI', 'Camera soundbar'].includes(b.nama);
          onUbah({ ...b, tipeKamera: v, w: baru.w, h: baru.h, d: baru.d, nama: namaBawaan ? baru.nama : b.nama });
        }} opsi={[{ v: 'ptz', l: 'PTZ' }, { v: 'ptz-ai', l: 'PTZ AI' }, { v: 'xbar', l: 'Soundbar' }]} />
      )}
      {b.jenis === 'lift' && (
        <>
          <Segmen label="Layar" nilai={b.naik === false ? 'turun' : 'naik'} onUbah={v => set({ naik: v === 'naik' })}
            opsi={[{ v: 'naik', l: 'Naik' }, { v: 'turun', l: 'Turun (rata meja)' }]} />
          <p className="text-[12px] text-slate-600">Letakkan di atas meja: "Dari lantai" = tinggi meja (umumnya 0,75 m).</p>
        </>
      )}
    </>
  );
}
