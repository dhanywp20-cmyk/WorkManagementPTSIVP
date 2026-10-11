'use client';
/** Atur teks / keterangan manual: isi, tinggi huruf, arah hadap, warna tulisan & latar (inti/teks.ts). */
import { Angka, Pilih } from '../../../bersama/ui';
import { type HadapTeks, LABEL_HADAP_TEKS, MAKS_TEKS, TINGGI_HURUF_MAKS, TINGGI_HURUF_MIN, tinggiHurufSah, warnaSah } from '../../inti';
import type { KonteksAtur } from './konteks';

/** Nama benda mengikuti baris pertama teks - kecuali sudah diganti sendiri. */
const namaDari = (t: string | undefined) => (t ?? '').split('\n')[0].trim().slice(0, 40) || 'Teks';

/** Tinggi pasang bawaan saat arah hadap diganti (lantai menempel, melayang di atas kepala). */
const ELEV_HADAP: Record<HadapTeks, number> = { berdiri: 1.6, lantai: 0.002, kamera: 2.2 };

export function AturTeks({ c }: { c: KonteksAtur }) {
  const { b, label, setUkuran } = c;
  if (b.jenis !== 'teks') return null;
  const hadap = b.hadapTeks ?? 'berdiri';
  const latar = warnaSah(b.latarTeks);
  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className={label}>Teks</span>
        <textarea value={b.teks ?? ''} maxLength={MAKS_TEKS} rows={3} placeholder="Tulis keterangan…"
          onChange={e => setUkuran({ teks: e.target.value, nama: b.nama === namaDari(b.teks) ? namaDari(e.target.value) : b.nama })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm resize-y" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Angka label="Tinggi huruf" satuan="cm" step={0.5} nilai={Math.round(tinggiHurufSah(b.tinggiHuruf) * 1000) / 10}
          onUbah={v => v >= TINGGI_HURUF_MIN * 100 && v <= TINGGI_HURUF_MAKS * 100 && setUkuran({ tinggiHuruf: v / 100 })} />
        <Pilih<HadapTeks> label="Arah" nilai={hadap}
          onUbah={v => setUkuran({ hadapTeks: v, elev: ELEV_HADAP[v] })}
          opsi={(Object.keys(LABEL_HADAP_TEKS) as HadapTeks[]).map(v => ({ v, l: LABEL_HADAP_TEKS[v] }))} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
          <input type="color" aria-label="Warna tulisan" value={warnaSah(b.warna) ?? '#0f172a'} onChange={e => c.set({ warna: e.target.value })}
            className="h-8 w-10 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
          Tulisan
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
          <input type="checkbox" className="w-4 h-4" checked={!!latar} onChange={e => c.set({ latarTeks: e.target.checked ? '#ffffff' : undefined })} />
          Latar
        </label>
        {latar && (
          <input type="color" aria-label="Warna latar" value={latar} onChange={e => c.set({ latarTeks: e.target.value })}
            className="h-8 w-10 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
        )}
      </div>
    </div>
  );
}
