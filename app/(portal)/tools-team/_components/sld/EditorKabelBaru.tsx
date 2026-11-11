'use client';
import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { GAYA_KABEL } from '@/lib/sld/gaya';
import { kodeKabel } from '@/lib/sld/geometri';
import { isiPreset, PRESET_KABEL } from '@/lib/sld/preset-kabel';
import { kelasKecil } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

export function EditorKabelBaru({ a }: { a: KeadaanSLD }) {
  const c = a.dok.kabel.find(k => k.id === a.kabelBaruId);
  const teksRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (c) teksRef.current?.focus(); }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const nama = (id: string) => a.dok.perangkat.find(p => p.id === id)?.nama || '?';
  const tutup = () => a.setKabelBaruId(null);
  const aktif = PRESET_KABEL.find(p => p.jenis === c.jenis && p.teks === c.teksGaris)?.k;
  return (
    <div role="dialog" aria-label="Atur kabel baru" onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') tutup(); }}
      className="absolute left-1/2 top-3 z-20 -translate-x-1/2 w-[min(560px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-dropdown space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-slate-800 truncate">
          <span style={{ color: GAYA_KABEL[c.jenis].warna }}>{kodeKabel(a.dok.kabel).get(c.id)}</span> · {nama(c.dari.p)} → {nama(c.ke.p)}
        </p>
        <button type="button" onClick={tutup} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-blue-800">
          <Check size={14} /> Selesai
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_KABEL.map(p => (
          <button key={p.k} type="button" onClick={() => { a.ubahKabel(c.id, isiPreset(p)); a.setPresetTerakhir(p.k); }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150 ${aktif === p.k ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <span className="h-[3px] w-4 rounded-full" style={{ background: GAYA_KABEL[p.jenis].warna }} />{p.l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Teks di garis</span>
          <input ref={teksRef} value={c.teksGaris} onChange={e => a.ubahKabel(c.id, { teksGaris: e.target.value })} placeholder="mis. Cat6 PoE+" className={kelasKecil} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Kabel / media (tabel)</span>
          <input value={c.media} onChange={e => a.ubahKabel(c.id, { media: e.target.value })} placeholder="mis. Cat6 patch" className={kelasKecil} />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">Pilihan terakhir dipakai otomatis untuk kabel berikutnya. Fungsi, port, dan catatan bisa diisi di panel Properti.</p>
    </div>
  );
}
