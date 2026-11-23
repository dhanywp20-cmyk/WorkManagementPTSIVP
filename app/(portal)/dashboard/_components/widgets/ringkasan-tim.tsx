'use client';

import React from 'react';
import type { Anggota, StatusLapor } from './daftar-tim';

export const WARNA_STATUS: Record<StatusLapor, string> = { manual: '#16a34a', otomatis: '#0d9488', kosong: '#ea580c' };

const namaDepan = (n: string) => n.split(' ')[0] || n;
const fmtTgl = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export function JadwalMingguTim({ rows, mulai, akhir, onBuka }: { rows: Anggota[]; mulai: string; akhir: string; onBuka: () => void }) {
  const total = rows.reduce((s, r) => s + r.jadwalMinggu, 0);
  const isi = rows.filter(r => r.jadwalMinggu > 0).sort((a, b) => b.jadwalMinggu - a.jadwalMinggu || a.name.localeCompare(b.name));
  const nol = rows.filter(r => r.jadwalMinggu === 0);
  const maks = Math.max(1, ...isi.map(r => r.jadwalMinggu));
  return (
    <div className="mt-3 pt-2.5 border-t border-slate-100">
      <button onClick={onBuka} className="w-full flex items-baseline justify-between gap-2 mb-1.5 text-left">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Jadwal minggu ini</span>
        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{fmtTgl(mulai)}–{fmtTgl(akhir)} · <b className="text-slate-900">{total}</b></span>
      </button>
      <div className="grid gap-1">
        {isi.map(r => (
          <div key={r.id} className="flex items-center gap-2 text-[12px]" title={`${r.name}: ${r.jadwalMinggu} jadwal`}>
            <span className="w-[62px] truncate font-semibold text-slate-700">{namaDepan(r.name)}</span>
            <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <span className="block h-full rounded-full bg-sky-600" style={{ width: `${(r.jadwalMinggu / maks) * 100}%` }} />
            </span>
            <span className="w-5 text-right font-bold text-slate-900 tabular-nums">{r.jadwalMinggu}</span>
          </div>
        ))}
        {nol.length > 0 && (
          <div className="text-[11px] text-slate-500 leading-snug" title={nol.map(r => r.name).join(', ')}>
            Tanpa jadwal: {nol.map(r => namaDepan(r.name)).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

export function BarisOtomatis({ m, onBuka }: { m: Anggota; onBuka: () => void }) {
  const rincian = [
    m.tiket.length ? `Tiket: ${m.tiket.join(', ')}` : '',
    m.jadwal.length ? `Jadwal: ${m.jadwal.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  return (
    <button onClick={onBuka} title={rincian}
      className="w-full flex items-start justify-between gap-2 py-1 px-1.5 hover:bg-slate-50 rounded-md transition-colors text-left">
      <span className="flex items-start gap-1.5 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[0.45em]" style={{ background: WARNA_STATUS.otomatis }} />
        <span className="text-[13px] font-semibold text-slate-700 leading-snug wrap-break-word">{m.name}</span>
      </span>
      <span className="text-[11px] font-semibold text-slate-500 shrink-0 tabular-nums leading-snug pt-px">{m.tiket.length} tiket · {m.jadwal.length} jadwal</span>
    </button>
  );
}
