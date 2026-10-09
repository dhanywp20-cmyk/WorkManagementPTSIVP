'use client';
/**
 * Pustaka Tools Team: katalog produk, data acuan & artikel panduan yang diisi tim (Admin) - dipakai
 * kalkulator lewat "dari Pustaka" dan bisa dibaca siapa pun untuk belajar mandiri.
 * Registri jenis: lib/pustaka.ts · data: /api/tools-team/pustaka (migrasi 040).
 */
import { useState } from 'react';
import { JENIS_PUSTAKA, type KelompokPustaka } from '@/lib/pustaka';
import { DaftarPustaka } from './pustaka/DaftarPustaka';

const KELOMPOK: { v: KelompokPustaka; l: string }[] = [
  { v: 'artikel', l: 'Belajar' }, { v: 'produk', l: 'Katalog produk' }, { v: 'data', l: 'Data acuan' },
];

export function Pustaka() {
  const [aktif, setAktif] = useState('artikel');
  const jenis = JENIS_PUSTAKA.find(j => j.v === aktif) ?? JENIS_PUSTAKA[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
      <nav aria-label="Jenis pustaka" className="rounded-2xl border border-slate-200 bg-white p-2 lg:sticky lg:top-24">
        {KELOMPOK.map(k => (
          <div key={k.v} className="mb-2 last:mb-0">
            <p className="px-2 pt-1.5 pb-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{k.l}</p>
            <div className="flex lg:flex-col gap-1 overflow-x-auto">
              {JENIS_PUSTAKA.filter(j => j.kelompok === k.v).map(j => {
                const on = j.v === aktif;
                return (
                  <button key={j.v} type="button" onClick={() => setAktif(j.v)} aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[13px] font-semibold whitespace-nowrap ${on ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <span aria-hidden="true">{j.ikon}</span>{j.l}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label={jenis.l}>
        <h2 className="text-[16px] font-bold text-slate-900 mb-2 flex items-center gap-2"><span aria-hidden="true">{jenis.ikon}</span>{jenis.l}</h2>
        <DaftarPustaka key={jenis.v} jenis={jenis} />
      </section>
    </div>
  );
}
