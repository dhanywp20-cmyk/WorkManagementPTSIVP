'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';

/** Komponen form & hasil bersama untuk semua alat di Tools Team. */

export const kelasInput = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

export function Angka({ label, nilai, onUbah, satuan, min = 0, step = 'any', bantuan }: {
  label: string; nilai: number; onUbah: (v: number) => void; satuan?: string; min?: number; step?: number | 'any'; bantuan?: string;
}) {
  //  Teks sementara supaya isian kosong / "1." tidak langsung jadi 0 saat diketik.
  const [teks, setTeks] = useState<string | null>(null);
  //  Nilai berubah dari LUAR isian ini (tombol reset, undo, pilih model lain) -> buang teks
  //  ketikan supaya isian tidak menampilkan angka basi. Perubahan dari ketikan sendiri dikenali
  //  lewat `terkirim`; ketikan yang ditolak induk (di luar batas) tidak mengubah `nilai`, jadi tetap.
  const terkirim = useRef<number | null>(null);
  useEffect(() => {
    if (terkirim.current === null || nilai !== terkirim.current) setTeks(null);
    terkirim.current = null;
  }, [nilai]);
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <span className="relative block">
        <input type="number" inputMode="decimal" min={min} step={step}
          value={teks ?? (Number.isFinite(nilai) ? String(nilai) : '')}
          onChange={e => { setTeks(e.target.value); const v = parseFloat(e.target.value.replace(',', '.')); if (Number.isFinite(v)) { terkirim.current = v; onUbah(v); } }}
          onBlur={() => setTeks(null)}
          className={`${kelasInput} ${satuan ? (satuan.length <= 2 ? 'pr-7' : 'pr-12') : ''}`} />
        {satuan && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none">{satuan}</span>}
      </span>
      {bantuan && <span className="block text-[11px] text-slate-500 mt-1">{bantuan}</span>}
    </label>
  );
}

export function Pilih<T extends string | number>({ label, nilai, onUbah, opsi }: {
  label: string; nilai: T; onUbah: (v: T) => void; opsi: { v: T; l: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <select value={String(nilai)} onChange={e => {
        const o = opsi.find(x => String(x.v) === e.target.value); if (o) onUbah(o.v);
      }} className={kelasInput}>
        {opsi.map(o => <option key={String(o.v)} value={String(o.v)}>{o.l}</option>)}
      </select>
    </label>
  );
}

export function Segmen<T extends string>({ nilai, onUbah, opsi, label }: { nilai: T; onUbah: (v: T) => void; opsi: { v: T; l: string }[]; label?: string }) {
  return (
    <div>
      {label && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>}
      <div role="radiogroup" className="flex gap-1 p-1 rounded-xl bg-slate-100">
        {opsi.map(o => (
          <button key={o.v} type="button" role="radio" aria-checked={nilai === o.v} onClick={() => onUbah(o.v)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[12.5px] font-semibold ${nilai === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Kartu({ judul, children, aksi }: { judul: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">{judul}</h2>
        {aksi}
      </div>
      {children}
    </section>
  );
}

/** Ubin angka hasil. `nada` mewarnai angka bila ada status (baik/peringatan). */
export function Nilai({ label, nilai, satuan, ket, nada }: { label: string; nilai: React.ReactNode; satuan?: string; ket?: React.ReactNode; nada?: 'baik' | 'awas' | 'buruk' }) {
  const warna = nada === 'baik' ? 'text-emerald-700' : nada === 'awas' ? 'text-amber-700' : nada === 'buruk' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 min-w-0">
      <p className="text-[11px] font-semibold text-slate-600 truncate">{label}</p>
      <p className={`text-lg sm:text-xl font-extrabold leading-tight tabular-nums mt-0.5 ${warna}`}>
        {nilai}{satuan && <span className="text-xs font-semibold text-slate-500 ml-1">{satuan}</span>}
      </p>
      {ket && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{ket}</p>}
    </div>
  );
}

export const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: d }) : '-');

/** Tombol salin ringkasan hasil (untuk ditempel ke WA / penawaran). */
export function TombolSalin({ teks, onCetak, onPng }: {
  teks: () => string;
  /** Lembar cetak tersendiri (lihat cetak.ts), bukan window.print(). */ onCetak?: () => void;
  /** Lembar yang sama sebagai gambar PNG. */ onPng?: () => Promise<void> | void;
}) {
  const [ok, setOk] = useState(false);
  const [png, setPng] = useState<'siap' | 'proses' | 'gagal'>('siap');
  return (
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(teks()); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* abaikan */ }
      }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
        <Ikon nama={ok ? '✅' : '📋'} ukuran={14} /> {ok ? 'Tersalin' : 'Salin hasil'}
      </button>
      {onCetak && (
        <button type="button" onClick={onCetak}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 print:hidden">
          <Ikon nama="🖨" ukuran={14} /> Cetak
        </button>
      )}
      {onPng && (
        <button type="button" disabled={png === 'proses'} title="Unduh lembar ini sebagai gambar PNG"
          onClick={async () => {
            setPng('proses');
            try { await onPng(); setPng('siap'); } catch { setPng('gagal'); setTimeout(() => setPng('siap'), 2500); }
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border print:hidden disabled:opacity-60 ${png === 'gagal' ? 'border-rose-200 text-rose-700 bg-rose-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          <Ikon nama="🖼" ukuran={14} /> {png === 'proses' ? 'Membuat...' : png === 'gagal' ? 'PNG gagal' : 'PNG'}
        </button>
      )}
    </div>
  );
}

export function Catatan({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] text-slate-500 leading-relaxed mt-3">{children}</p>;
}
