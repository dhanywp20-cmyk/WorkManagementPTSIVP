'use client';
import { useSyncExternalStore } from 'react';

export type OpsiTampil = '1' | '2' | '3';
export type BagianBeranda = 'ringkasan' | 'rincian';

const OPSI: { k: OpsiTampil; label: string }[] = [
  { k: '1', label: '1 · Kecil 70%' },
  { k: '2', label: '2 · Semua muat' },
  { k: '3', label: '3 · Tab Rincian' },
];

const langgan = () => () => {};
const bacaUrl = () => window.location.search;
const bacaServer = () => '';

export function usePratinjauTampil(): OpsiTampil | null {
  const cari = useSyncExternalStore(langgan, bacaUrl, bacaServer);
  const v = new URLSearchParams(cari).get('tampil');
  return v === '1' || v === '2' || v === '3' ? v : null;
}

export function PilihPratinjau({ aktif }: { aktif: OpsiTampil }) {
  return (
    <nav aria-label="Pratinjau tampilan dashboard" className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 p-1">
      <span className="px-2 text-[11px] font-bold text-amber-800">Pratinjau</span>
      {OPSI.map(o => (
        <a key={o.k} href={`?tampil=${o.k}`} aria-current={o.k === aktif ? 'page' : undefined}
          className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold transition-colors ${o.k === aktif ? 'bg-amber-600 text-white' : 'text-amber-900 hover:bg-amber-100'}`}>
          {o.label}
        </a>
      ))}
    </nav>
  );
}

export function SegmenBagian({ aktif, onPilih }: { aktif: BagianBeranda; onPilih: (b: BagianBeranda) => void }) {
  return (
    <div className="bb-segmen" role="group" aria-label="Bagian dashboard">
      {(['ringkasan', 'rincian'] as const).map(b => (
        <button key={b} type="button" aria-pressed={b === aktif} onClick={() => onPilih(b)}>
          {b === 'ringkasan' ? 'Ringkasan' : 'Rincian'}
        </button>
      ))}
    </div>
  );
}
