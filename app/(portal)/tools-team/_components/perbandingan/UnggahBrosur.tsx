'use client';
/** Daftar brosur PDF: tambah (pilih / seret), nama produk manual, pilih produk unggulan, hapus. Teks dibaca di peramban. */
import { useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Star, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { MAKS_PRODUK } from '@/lib/perbandingan';
import type { HasilBaca } from './bacaPdf';

export interface Brosur { id: string; file: File; nama: string; status: 'membaca' | 'siap' | 'galat'; hasil?: HasilBaca; galat?: string }

export function UnggahBrosur({ daftar, unggulan, tambah, ubah, hapus, pilihUnggulan, kunci }: {
  daftar: Brosur[]; unggulan: string | null; kunci: boolean;
  tambah: (f: File[]) => void; ubah: (id: string, nama: string) => void; hapus: (id: string) => void; pilihUnggulan: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [seret, setSeret] = useState(false);
  const penuh = daftar.length >= MAKS_PRODUK;
  return (
    <div className="space-y-2">
      <div onDragOver={e => { e.preventDefault(); setSeret(true); }} onDragLeave={() => setSeret(false)}
        onDrop={e => { e.preventDefault(); setSeret(false); if (!kunci) tambah([...e.dataTransfer.files]); }}
        className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${seret ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}>
        <button type="button" disabled={kunci || penuh} onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
          <Upload size={15} /> Tambah brosur PDF
        </button>
        <p className="mt-1.5 text-[12px] text-slate-500" title="Teks dibaca di perangkat Anda; berkas tidak diunggah ke server">2–{MAKS_PRODUK} produk · PDF berteks (bukan scan)</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={e => { tambah([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </div>
      {daftar.map(b => (
        <div key={b.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${unggulan === b.id ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'}`}>
          <FileText size={18} className="text-slate-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-800" title={b.file.name}>{b.file.name}</p>
            <p className="text-[11.5px] text-slate-500 flex items-center gap-1">
              {b.status === 'membaca' && <><Loader2 size={12} className="animate-spin" /> Membaca…</>}
              {b.status === 'siap' && <><CheckCircle2 size={12} className="text-emerald-600" /> {b.hasil?.jumlahHalaman} hal · {Math.round((b.hasil?.karakter ?? 0) / 100) / 10}k karakter</>}
              {b.status === 'galat' && <span className="flex items-center gap-1 text-rose-700"><TriangleAlert size={12} /> {b.galat}</span>}
            </p>
          </div>
          <input value={b.nama} onChange={e => ubah(b.id, e.target.value)} disabled={kunci} placeholder="Nama produk (opsional)" aria-label="Nama produk"
            className="w-full sm:w-56 rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-[13px]" />
          <button type="button" onClick={() => pilihUnggulan(b.id)} disabled={kunci} aria-pressed={unggulan === b.id} title="Produk yang kita tawarkan (kolom pertama, RECOMMENDED)"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border ${unggulan === b.id ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Star size={13} /> Unggulan
          </button>
          <button type="button" onClick={() => hapus(b.id)} disabled={kunci} aria-label={`Hapus ${b.file.name}`} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}
