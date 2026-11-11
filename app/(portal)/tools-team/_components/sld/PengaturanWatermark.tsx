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
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-1">
      <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[12.5px] font-bold text-slate-700 min-h-[36px]">
        <button type="button" role="switch" aria-checked={aktif} onClick={() => a.setWatermark(!aktif)}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${aktif ? 'bg-blue-700' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${aktif ? 'translate-x-4' : ''}`} />
        </button>
        Watermark
      </label>
      <img src={a.logo ?? WATERMARK_BAWAAN} alt="Logo watermark" className={`h-6 max-w-[72px] object-contain ${aktif ? '' : 'opacity-40 grayscale'}`} />
      <button type="button" className={`${kelasTombol} !px-2 !py-1.5 !text-[12px]`} onClick={() => berkas.current?.click()} title="Logo hanya disimpan di browser ini">
        <ImageUp size={14} /> Ganti logo
      </button>
      {a.logo && (
        <button type="button" className={`${kelasTombol} !px-2 !py-1.5 !text-[12px]`} onClick={() => a.setLogo(null)} title="Kembali ke logo IndoVisual">
          <RotateCcw size={14} /> Bawaan
        </button>
      )}
      <input ref={berkas} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void ganti(e.target.files?.[0])} />
      {galat && <span role="alert" className="text-[12px] text-rose-700">{galat}</span>}
    </div>
  );
}
