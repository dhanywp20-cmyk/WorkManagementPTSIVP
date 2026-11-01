'use client';
/**
 * Posisi proyektor di panel Atur: diukur di UJUNG LENSA (bukan tengah badan) + Projection distance (L) seperti
 * kalkulator Panasonic - jarak lensa ke layar / bidang yang dituju, bisa diisi langsung. Rumus: inti/jarakProyeksi.ts.
 */
import { useState } from 'react';
import { Angka, Catatan, f, fTetap } from '../../../bersama/ui';
import {
  aturJarakProyeksi, type Benda, jarakProyeksi, jepitProyektor, keDunia, lebarGambarDi, lensaProyektor, posisiDariLensa,
  rasioGambarProyektor, throwRatioDari,
} from '../../inti';
import type { KonteksAtur } from './konteks';

const mm = (v: number) => Math.round(v * 1000) / 1000;

export function PosisiProyektor({ c }: { c: KonteksAtur }) {
  const { b, batas, plafon, label, set, semua, ruang } = c;
  /** Pesan bila jarak / posisi yang diminta tidak tercapai karena lensa harus tetap di dalam ruang. */
  const [peringatan, setPeringatan] = useState<string | null>(null);
  //  Yang wajib di dalam ruang hanya lensanya (badan boleh tertanam di plafon / dinding) - jepitProyektor.
  const jepit = (ubah: Pick<Benda, 'x' | 'z' | 'elev'>) => {
    const j = jepitProyektor({ ...b, ...ubah }, batas.x, batas.z, plafon);
    return { x: mm(j.x), z: mm(j.z), elev: mm(j.elev) };
  };
  const [lx, ly, lz] = keDunia(b, lensaProyektor(b));
  const ubahLensa = (sumbu: 'x' | 'y' | 'z', v: number) => {
    const baru = jepit(posisiDariLensa(b, { [sumbu]: v }));
    const [nx, ny, nz] = keDunia({ ...b, ...baru }, lensaProyektor({ ...b, ...baru }));
    const tercapai = { x: nx, y: ny, z: nz }[sumbu];
    setPeringatan(Math.abs(tercapai - v) > 0.005 ? `Lensa ditahan ${f(tercapai, 3)} m - lensa harus ≥ 3 cm dari dinding, lantai & plafon.` : null);
    set(baru);
  };

  const jp = jarakProyeksi(b, semua, ruang);
  const tr = throwRatioDari(b);
  const lebar = jp.jarak !== null ? lebarGambarDi(b, jp.jarak, tr) : 0, tinggi = lebar * rasioGambarProyektor(b);
  const ubahJarak = (v: number) => {
    if (!(v >= 0.1 && v <= 60)) return;
    const pos = aturJarakProyeksi(b, semua, ruang, v);
    if (!pos) return;
    const baru = jepit(pos);
    const tercapai = jarakProyeksi({ ...b, ...baru }, semua.map(x => (x.id === b.id ? { ...b, ...baru } : x)), ruang).jarak ?? v;
    setPeringatan(Math.abs(tercapai - v) > 0.005 ? `Ruang tidak cukup: projection distance maksimal ±${f(tercapai, 3)} m di posisi ini.` : null);
    set(baru);
  };
  const ke = jp.sasaran ? jp.sasaran.nama : 'dinding / lantai ruang';

  return (
    <div className="space-y-2">
      <div>
        <span className={label}>Posisi lensa (ujung lensa, bukan tengah badan)</span>
        <div className="grid grid-cols-2 gap-2">
          <Angka label="X lensa" nilai={mm(lx)} satuan="m" step={0.01} onUbah={v => ubahLensa('x', v)} />
          <Angka label="Z lensa" nilai={mm(lz)} satuan="m" step={0.01} onUbah={v => ubahLensa('z', v)} />
          <Angka label="Tinggi lensa (Y)" nilai={mm(ly)} satuan="m" step={0.01} onUbah={v => v >= 0 && ubahLensa('y', v)} />
          <Angka label="Putar" nilai={b.rot} satuan="°" onUbah={v => set({ rot: ((v % 360) + 360) % 360 })} />
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 space-y-1.5">
        {jp.jarak !== null ? (
          <>
            <Angka label="Projection distance (L)" nilai={mm(jp.jarak)} satuan="m" step={0.01} onUbah={ubahJarak}
              bantuan="Jarak ujung lensa ke layar / bidang - sama dengan L di kalkulator Panasonic. Mengubahnya menggeser proyektor maju-mundur." />
            <p className="text-[12px] text-slate-700 leading-snug tabular-nums">
              Ke <b>{ke}</b> - {jp.cara === 'tegak' ? 'tegak lurus bidang (L kalkulator Panasonic)' : 'sepanjang sumbu lensa ke titik bidik'}.
              Gambar <b>{fTetap(lebar)} × {fTetap(tinggi)} m</b> ({fTetap(Math.hypot(lebar, tinggi) / 0.0254, 2)}&quot;) pada TR {f(tr, 6)}.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-slate-600">Sumbu lensa tidak mengarah ke layar, bidang, maupun permukaan ruang - projection distance tidak bisa dihitung.</p>
        )}
        {peringatan && <p className="text-[12px] font-semibold text-amber-700">{peringatan}</p>}
      </div>
      <Catatan>
        Badan proyektor: tengah X {f(b.x, 3)} · Z {f(b.z, 3)} m, bawah badan {f(b.elev, 3)} m dari lantai (untuk bracket / drop pole).
        {jp.cara === 'tegak' ? ' Layar & bidang datar: proyektor bergeser tegak lurus bidang, posisi kiri-kanan & tinggi lensa tetap.' : ' Bidang lengkung / dinding: proyektor bergeser searah sumbunya, titik bidik tetap.'}
      </Catatan>
    </div>
  );
}
