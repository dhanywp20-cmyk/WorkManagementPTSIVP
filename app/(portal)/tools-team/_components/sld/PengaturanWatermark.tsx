'use client';
import { useRef, useState } from 'react';
import { ImageUp, RotateCcw } from 'lucide-react';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { kompresGambar } from './gambar';
import { kelasTombol } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

export function PengaturanWatermark({ a }: { a: KeadaanSLD }) {
  const berkas = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState('');
  const aktif = a.dok.watermark;
  const ganti = async (f?: File | null) => {
    if (!f) return;
    setGalat('');
    try { a.setLogo((await kompresGambar(f)).dataUrl); a.setWatermark(true); } catch (e) { setGalat(e instanceof Error ? e.message : 'Logo gagal dipakai.'); } finally {
      if (berkas.current) berkas.current.value = '';
    }
  };
  return (
    <div className="space-y-2 px-2.5 py-1.5">
      <Sakelar label="Watermark logo" nilai={aktif} onUbah={v => a.setWatermark(v)} />
      <div className="flex items-center gap-1.5">
        <img src={a.logo ?? WATERMARK_BAWAAN} alt="Logo watermark" className={`h-7 w-16 rounded border border-slate-100 object-contain ${aktif ? '' : 'opacity-40 grayscale'}`} />
        <button type="button" className={`${kelasTombol} !h-8 !px-2 !py-0 !text-[12px] !rounded-lg`} onClick={() => berkas.current?.click()} title="Logo hanya disimpan di browser ini">
          <ImageUp size={14} /> Ganti logo
        </button>
        {a.logo && (
          <button type="button" className={`${kelasTombol} !h-8 !px-2 !py-0 !text-[12px] !rounded-lg`} onClick={() => a.setLogo(null)} title="Kembali ke logo IndoVisual">
            <RotateCcw size={14} /> Bawaan
          </button>
        )}
      </div>
      <input ref={berkas} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void ganti(e.target.files?.[0])} />
      {galat && <p role="alert" className="text-[12px] text-rose-700">{galat}</p>}
    </div>
  );
}

export function Sakelar({ label, nilai, onUbah, judul }: { label: string; nilai: boolean; onUbah: (v: boolean) => void; judul?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-[13px] font-medium text-slate-700" title={judul}>
      {label}
      <button type="button" role="switch" aria-checked={nilai} aria-label={label} onClick={() => onUbah(!nilai)}
        className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${nilai ? 'bg-blue-700' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${nilai ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}
