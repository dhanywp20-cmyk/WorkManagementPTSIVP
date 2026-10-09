'use client';
/**
 * Atur kabel ke rack satu perangkat: otomatis (aturan inti/kabel.ts) atau diatur sendiri - jenis
 * kabel (warna legend) & jumlah tarikan. Jalurnya tetap otomatis (siku-siku lewat plafon / lantai).
 */
import { GOLONGAN_SINYAL, kabelOtomatis, MAKS_TARIKAN, type GolonganKabelSinyal, type Jenis, type KabelCustom } from '../../inti';
import type { KonteksAtur } from './konteks';

/** Benda pasif / bidang: tidak punya kabel sinyal. */
const TANPA_KABEL: Jenis[] = ['kursi', 'tribun', 'panggung', 'bidang', 'objek', 'model', 'rak'];

const hex = (w: number) => `#${w.toString(16).padStart(6, '0')}`;
const ringkas = (d: KabelCustom[]) =>
  d.length ? d.map(k => `${GOLONGAN_SINYAL.find(g => g.golongan === k.golongan)?.label ?? k.golongan} ×${k.jumlah}`).join(' · ') : 'tanpa kabel sinyal';

export function AturKabel({ c }: { c: KonteksAtur }) {
  const { b, set, semua, label } = c;
  if (TANPA_KABEL.includes(b.jenis)) return null;
  const otomatis = kabelOtomatis(b, semua);
  const custom = b.kabelCustom;
  const adaRak = semua.some(x => x.jenis === 'rak');
  const ubah = (i: number, x: Partial<KabelCustom>) => set({ kabelCustom: custom!.map((k, j) => (j === i ? { ...k, ...x } : k)) });
  const tombol = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50';

  return (
    <div className="rounded-xl border border-slate-200 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={label + ' !mb-0'}>Kabel ke rack</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[12px] font-semibold" role="radiogroup" aria-label="Pengaturan kabel">
          {([['Otomatis', !custom], ['Atur sendiri', !!custom]] as const).map(([l, aktif]) => (
            <button key={l} type="button" role="radio" aria-checked={aktif}
              onClick={() => set({ kabelCustom: l === 'Otomatis' ? undefined : custom ?? otomatis.map(k => ({ ...k })) })}
              className={`px-2 py-1 ${aktif ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{l}</button>
          ))}
        </div>
      </div>

      {!custom ? (
        <p className="text-[12px] text-slate-600" title="Atur sendiri: ganti jenis (warna) atau jumlah kabel">{ringkas(otomatis)}</p>
      ) : (
        <>
          {custom.map((k, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
                style={{ background: hex(GOLONGAN_SINYAL.find(g => g.golongan === k.golongan)?.warna ?? 0) }} />
              <select value={k.golongan} onChange={e => ubah(i, { golongan: e.target.value as GolonganKabelSinyal })} aria-label={`Jenis kabel ${i + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-base sm:text-[13px]">
                {GOLONGAN_SINYAL.map(g => <option key={g.golongan} value={g.golongan}>{g.nama} · {g.label}</option>)}
              </select>
              <button type="button" className={tombol} aria-label="Kurangi" onClick={() => ubah(i, { jumlah: Math.max(1, k.jumlah - 1) })}>−</button>
              <span className="w-6 text-center text-[13px] font-bold tabular-nums" aria-label={`Jumlah ${k.jumlah}`}>{k.jumlah}</span>
              <button type="button" className={tombol} aria-label="Tambah" onClick={() => ubah(i, { jumlah: Math.min(MAKS_TARIKAN, k.jumlah + 1) })}>+</button>
              <button type="button" className={tombol} aria-label="Hapus kabel ini" onClick={() => set({ kabelCustom: custom.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={tombol}
              onClick={() => set({ kabelCustom: [...custom, { golongan: GOLONGAN_SINYAL.find(g => !custom.some(k => k.golongan === g.golongan))?.golongan ?? 'lan', jumlah: 1 }] })}>
              + Tambah kabel
            </button>
          </div>
          <p className="text-[12px] text-slate-600" title="HDMI > 10 m ditulis HDMI AOC; jalurnya tetap otomatis">Otomatis: {ringkas(otomatis)}</p>
        </>
      )}
      {!adaRak && <p className="text-[12px] text-amber-700">Belum ada rack</p>}
    </div>
  );
}
