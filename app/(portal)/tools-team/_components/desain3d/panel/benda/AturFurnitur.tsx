'use client';
/** Atur furnitur: meja (bentuk, finish, monitor operator), kursi, tribun. */
import { Angka, f, Pilih, Segmen, Catatan } from '../../../bersama/ui';
import { barisTribun, bendaBaru, type BentukMeja, type Finish, kursiTribunPerBaris, type TipeKursi } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturFurnitur({ c }: { c: KonteksAtur }) {
  const { b, kosong, onUbah, set, setUkuran } = c;
  return (
    <>
      {b.jenis === 'meja' && (
        <>
          <Pilih label="Bentuk meja" nilai={b.bentukMeja ?? 'rapat'} onUbah={(v: BentukMeja) => {
            const baru = bendaBaru('meja', kosong, { bentukMeja: v });
            const namaBawaan = /^(Meja|Podium|Kredensa)/.test(b.nama);
            onUbah({ ...b, bentukMeja: v, w: baru.w, h: baru.h, d: baru.d, finish: baru.finish, monitorMeja: baru.monitorMeja, nama: namaBawaan ? baru.nama : b.nama });
          }} opsi={[{ v: 'rapat', l: 'Meja rapat' }, { v: 'bulat', l: 'Meja bundar' }, { v: 'kelas', l: 'Meja kelas' }, { v: 'dosen', l: 'Meja dosen' },
            { v: 'podium', l: 'Podium' }, { v: 'kredensa', l: 'Kredensa (lemari rendah)' }, { v: 'operator', l: 'Meja operator (control room)' }] as { v: BentukMeja; l: string }[]} />
          {b.bentukMeja === 'operator' && (
            <Angka label="Jumlah monitor" nilai={b.monitorMeja ?? 4} step={1} onUbah={v => v >= 0 && v <= 12 && set({ monitorMeja: Math.round(v) })}
              bantuan="Berderet di sisi depan meja; keyboard 1 per 2 monitor" />
          )}
          <Segmen label="Permukaan" nilai={b.finish ?? (b.bentukMeja === 'kelas' ? 'oak' : 'walnut')} onUbah={(v: Finish) => set({ finish: v })}
            opsi={[{ v: 'walnut', l: 'Walnut' }, { v: 'oak', l: 'Oak' }, { v: 'putih', l: 'Putih' }]} />
          {b.bentukMeja === 'bulat' && <Catatan>Lebar = panjang untuk bundar; beda nilai = oval.</Catatan>}
        </>
      )}
      {b.jenis === 'kursi' && (
        <Segmen label="Tipe kursi" nilai={b.tipeKursi ?? 'kantor'} onUbah={(v: TipeKursi) => {
          const baru = bendaBaru('kursi', kosong, { tipeKursi: v });
          onUbah({ ...b, tipeKursi: v, w: baru.w, h: baru.h, d: baru.d, nama: b.nama.startsWith('Kursi') ? baru.nama : b.nama });
        }} opsi={[{ v: 'kantor', l: 'Kantor (beroda)' }, { v: 'kelas', l: 'Kelas' }]} />
      )}
      {b.jenis === 'tribun' && (
        <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Tribun</p>
          <div className="grid grid-cols-2 gap-2">
            <Angka label="Jumlah baris" nilai={barisTribun(b)} step={1} onUbah={v => v >= 1 && v <= 60 && setUkuran({ baris: Math.round(v) })} />
            <Angka label="Kursi per baris" nilai={kursiTribunPerBaris(b)} step={1} onUbah={v => v >= 1 && v <= 80 && setUkuran({ kursiBaris: Math.round(v) })} />
            <Angka label="Tinggi anak tangga" nilai={b.tinggiAnak ?? 0.35} satuan="m" step={0.05} onUbah={v => v >= 0.1 && v <= 1 && setUkuran({ tinggiAnak: v })} />
          </div>
          <p className="text-[12px] text-slate-600">{barisTribun(b) * kursiTribunPerBaris(b)} kursi · kedalaman baris {f(b.d / barisTribun(b))} m · baris teratas {f((barisTribun(b) - 1) * (b.tinggiAnak ?? 0.35))} m dari lantai. Kursinya ikut dihitung di Analisis tampilan.</p>
        </div>
      )}
    </>
  );
}
