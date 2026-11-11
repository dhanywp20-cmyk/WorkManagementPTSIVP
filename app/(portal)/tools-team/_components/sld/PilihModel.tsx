'use client';
import { useId, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { semuaPerangkat } from '@/lib/sld/ruang';
import { grupModel } from '@/lib/sld/turunan';
import { Isian, kelasKecil, kelasTombol } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

const rapi = (s: string) => s.trim().toLowerCase();

export function PilihModel({ a, ids, saran = [] }: { a: KeadaanSLD; ids: string[]; saran?: string[] }) {
  const daftarId = useId();
  const [baru, setBaru] = useState<string | null>(null);
  const daftar = a.dok.perangkat.filter(p => ids.includes(p.id));
  const p0 = daftar[0];
  if (!p0) return null;
  const sama = daftar.every(p => rapi(p.model) === rapi(p0.model) && rapi(p.kategori) === rapi(p0.kategori));
  const grup = grupModel(semuaPerangkat(a.proyek))
    .sort((x, y) => Number(rapi(y.kategori) === rapi(p0.kategori)) - Number(rapi(x.kategori) === rapi(p0.kategori)) || x.model.localeCompare(y.model));
  const aktif = (g: { model: string; kategori: string }) => sama && rapi(g.model) === rapi(p0.model) && rapi(g.kategori) === rapi(p0.kategori);
  const simpan = () => {
    const m = (baru ?? '').trim().slice(0, 120);
    if (m) a.aturModel(ids, m, daftar.length > 1 ? p0.kategori : undefined);
    setBaru(null);
  };
  return (
    <Isian label="Grup BOQ (model / part no)"
      bantuan="Kategori + model sama = satu baris di Sheet 2 & BOQ, qty dijumlah, walau nama di diagram beda. Pilih grup yang ada atau buat model baru sebagai grup sendiri.">
      <div className="flex flex-wrap gap-1.5">
        {grup.slice(0, 24).map(g => (
          <button key={`${g.kategori}|${g.model}`} type="button" aria-pressed={aktif(g)} onClick={() => a.aturModel(ids, g.model, g.kategori)} title={`${g.kategori} · ${g.jumlah} unit di proyek`}
            className={`${kelasTombol} !py-1 !px-2.5 !text-[12px] ${aktif(g) ? '!bg-blue-700 !text-white !border-blue-700' : ''}`}>
            {g.model} <span className={`text-[10.5px] font-bold ${aktif(g) ? 'text-blue-100' : 'text-slate-500'}`}>×{g.jumlah}</span>
          </button>
        ))}
        {sama && p0.model.trim() && (
          <button type="button" onClick={() => a.aturModel(ids, '')} className={`${kelasTombol} !py-1 !px-2.5 !text-[12px] text-slate-600`}>Lepas dari grup</button>
        )}
        {baru === null && (
          <button type="button" onClick={() => setBaru('')} className={`${kelasTombol} !py-1 !px-2.5 !text-[12px] text-blue-700`}><Plus size={14} /> Model baru</button>
        )}
      </div>
      {baru !== null && (
        <div className="mt-1.5 flex gap-1.5">
          <input autoFocus value={baru} onChange={e => setBaru(e.target.value)} list={daftarId} placeholder="mis. Philips 86BDL3652T" aria-label="Nama model baru" className={kelasKecil}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); simpan(); } else if (e.key === 'Escape') setBaru(null); }} />
          <button type="button" onClick={simpan} className={kelasTombol} aria-label="Simpan model baru"><Check size={15} /></button>
          <button type="button" onClick={() => setBaru(null)} className={kelasTombol} aria-label="Batal"><X size={15} /></button>
          <datalist id={daftarId}>{saran.map(x => <option key={x} value={x} />)}</datalist>
        </div>
      )}
    </Isian>
  );
}
