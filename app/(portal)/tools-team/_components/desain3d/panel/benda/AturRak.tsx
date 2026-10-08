'use client';
/** Atur rack: ukuran U, tipe pintu, isi rack (elevation) + editor & PNG elevation. */
import { namaBerkas, unduhSvgPNG } from '../../../bersama/cetak';
import { Angka, Pilih, Segmen } from '../../../bersama/ui';
import { type Benda, isiRakDari, JENIS_RAK, type JenisPerangkatRak, PERANGKAT_RAK, type PerangkatRak, RAK_U, susunRak, svgElevasiRak } from '../../inti';
import { useState } from 'react';
import type { KonteksAtur } from './konteks';

/** Rack elevation: isi rack per U (urutan dari atas), diagram, dan unduh PNG. */
function EditorRak({ b, onUbah }: { b: Benda; onUbah: (isi: PerangkatRak[] | undefined) => void }) {
  const [buka, setBuka] = useState(false);
  const isi = isiRakDari(b);
  const s = susunRak(b);
  const ubah = (i: number, x: Partial<PerangkatRak>) => onUbah(isi.map((p, j) => (j === i ? { ...p, ...x } : p)));
  const pindah = (i: number, arah: -1 | 1) => {
    const j = i + arah; if (j < 0 || j >= isi.length) return;
    const baru = [...isi]; [baru[i], baru[j]] = [baru[j], baru[i]]; onUbah(baru);
  };
  const [png, setPng] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const unduh = async () => {
    setPng('proses');
    try { await unduhSvgPNG(svgElevasiRak(b), namaBerkas('Rack elevation', b.nama), 2); setPng('siap'); }
    catch { setPng('gagal'); setTimeout(() => setPng('siap'), 2500); }
  };
  return (
    <div className="rounded-xl border border-slate-200 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-slate-800">Rack elevation</span>
        <span className={`text-[12px] tabular-nums font-semibold ${s.lewat ? 'text-rose-700' : 'text-slate-600'}`}>{s.terpakai + s.lewat} / {s.U} U</span>
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-1 [&>svg]:mx-auto [&>svg]:block max-h-72 overflow-y-auto" dangerouslySetInnerHTML={{ __html: svgElevasiRak(b, false) }} />
      {s.lewat > 0 && <p className="text-[11.5px] font-semibold text-rose-700">Melebihi kapasitas {s.lewat}U - kurangi perangkat atau tinggikan rack.</p>}
      <div className="flex gap-1.5 flex-wrap">
        <button type="button" onClick={() => setBuka(v => !v)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100">
          {buka ? 'Tutup editor' : 'Atur isi rack'}
        </button>
        <button type="button" onClick={() => void unduh()} disabled={png === 'proses'} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {png === 'proses' ? '...' : png === 'gagal' ? 'PNG gagal' : 'PNG'}
        </button>
        {b.isiRak?.length ? <button type="button" onClick={() => onUbah(undefined)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 hover:underline">Isi bawaan</button> : null}
      </div>
      {buka && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Urutan dari atas (U{s.U}) ke bawah (U1). Ikut tergambar di rack 3D, cetak, dan PNG.</p>
          {isi.map((p, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_52px_auto] gap-1 items-center">
              <div className="min-w-0 space-y-1">
                <select value={p.jenis} aria-label={`Jenis perangkat ${i + 1}`}
                  onChange={e => { const j = e.target.value as JenisPerangkatRak; ubah(i, { jenis: j, u: PERANGKAT_RAK[j].u, nama: PERANGKAT_RAK[j].label }); }}
                  className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px]">
                  {JENIS_RAK.map(j => <option key={j} value={j}>{PERANGKAT_RAK[j].label}</option>)}
                </select>
                <input value={p.nama} maxLength={60} aria-label={`Nama perangkat ${i + 1}`} onChange={e => ubah(i, { nama: e.target.value })}
                  className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px]" />
              </div>
              <input type="number" min={1} max={12} step={1} value={p.u} aria-label={`Tinggi U perangkat ${i + 1}`}
                onChange={e => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 12) ubah(i, { u: v }); }}
                className="w-full rounded-md border border-slate-200 bg-white px-1 py-1 text-[12px] text-center tabular-nums" />
              <div className="flex flex-col">
                <button type="button" aria-label="Naikkan" onClick={() => pindah(i, -1)} className="px-1.5 text-[11px] text-slate-600 hover:text-blue-700">▲</button>
                <button type="button" aria-label="Turunkan" onClick={() => pindah(i, 1)} className="px-1.5 text-[11px] text-slate-600 hover:text-blue-700">▼</button>
                <button type="button" aria-label="Hapus" onClick={() => onUbah(isi.filter((_, j) => j !== i))} className="px-1.5 text-[11px] text-rose-600 hover:text-rose-800">✕</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onUbah([...isi, { jenis: 'switch', u: 1, nama: PERANGKAT_RAK.switch.label }])}
            className="w-full py-1.5 rounded-lg border border-dashed border-slate-300 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">+ Tambah perangkat</button>
        </div>
      )}
    </div>
  );
}

export function AturRak({ c }: { c: KonteksAtur }) {
  const { b, set, setUkuran } = c;
  return (
    <>
      {b.jenis === 'rak' && (
        <Segmen label="Tipe rack" nilai={b.tipeRak ?? 'kaca'} onUbah={(v: 'kaca' | 'tertutup' | 'open') => set({ tipeRak: v })}
          opsi={[{ v: 'kaca', l: 'Pintu kaca' }, { v: 'tertutup', l: 'Tertutup' }, { v: 'open', l: 'Open frame' }]} />
      )}
      {b.jenis === 'rak' && (
        <div className="grid grid-cols-2 gap-2">
          <Pilih label="Tinggi rack" nilai={RAK_U.includes(b.rakU ?? 20) ? b.rakU ?? 20 : -1}
            onUbah={v => { const u = v > 0 ? v : (b.rakU && !RAK_U.includes(b.rakU) ? b.rakU : 15); setUkuran({ rakU: u, nama: b.nama.startsWith('Rack') ? `Rack ${u}U` : b.nama }); }}
            opsi={[...RAK_U.map(u => ({ v: u, l: `${u}U` })), { v: -1, l: 'Custom...' }]} />
          <Pilih label="Kedalaman" nilai={[0.6, 0.8, 1.0].includes(b.d) ? b.d : -1} onUbah={v => v > 0 && set({ d: v })}
            opsi={[...[0.6, 0.8, 1.0].map(d => ({ v: d, l: `${d * 1000} mm` })), ...([0.6, 0.8, 1.0].includes(b.d) ? [] : [{ v: -1, l: `${Math.round(b.d * 1000)} mm (custom)` }])]} />
          {!RAK_U.includes(b.rakU ?? 20) && (
            <Angka label="Jumlah U" nilai={b.rakU ?? 20} satuan="U" step={1}
              onUbah={v => v >= 4 && v <= 60 && setUkuran({ rakU: Math.round(v), nama: b.nama.startsWith('Rack') ? `Rack ${Math.round(v)}U` : b.nama })} />
          )}
        </div>
      )}
      {b.jenis === 'rak' && <EditorRak b={b} onUbah={isiRak => set({ isiRak })} />}
    </>
  );
}
