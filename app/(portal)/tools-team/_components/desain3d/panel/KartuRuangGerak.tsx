'use client';
/** Kartu cek ruang gerak (inti/ruangGerak.ts): klik catatan = pilih bendanya di kanvas. */
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, DoorOpen, Layers, Maximize2, Server, Table2 } from 'lucide-react';
import { cekRuangGerak, JARAK_MEJA_MIN, type KodeRuangGerak, SERVIS_RAK_MIN } from '../inti';
import { Kartu } from '../../bersama/ui';
import type { AlatDesain } from './alat';

const IKON: Record<KodeRuangGerak, typeof Layers> = { tumpang: Layers, keluar: Maximize2, plafon: Maximize2, pintu: DoorOpen, meja: Table2, rak: Server };
const ATURAN = `Benda bertumpuk · menembus dinding / plafon · ayunan pintu · meja ↔ dinding ≥ ${JARAK_MEJA_MIN * 100} cm · depan rack ≥ ${SERVIS_RAK_MIN * 100} cm`;

export function KartuRuangGerak({ a }: { a: AlatDesain }) {
  const { benda, ruang, pilih, setPilih } = a.K;
  const catatan = useMemo(() => cekRuangGerak(benda, ruang), [benda, ruang]);
  return (
    <Kartu judul={`Cek ruang gerak${catatan.length ? ` · ${catatan.length}` : ''}`}>
      {catatan.length === 0
        ? <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700" title={ATURAN}><CheckCircle2 size={16} /> Semua jarak aman</p>
        : (
          <ul className="space-y-1">
            {catatan.map((c, i) => {
              const Ikon = IKON[c.kode];
              return (
                <li key={`${c.kode}-${c.id}-${i}`}>
                  <button type="button" onClick={() => setPilih(c.id)} title="Pilih di kanvas"
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[12.5px] border ${pilih === c.id ? 'border-amber-300 bg-amber-50' : 'border-transparent hover:bg-slate-50'}`}>
                    <Ikon size={15} className={c.kode === 'tumpang' || c.kode === 'keluar' || c.kode === 'plafon' ? 'text-rose-600 shrink-0' : 'text-amber-600 shrink-0'} />
                    <span className="text-slate-800">{c.pesan}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      {catatan.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500" title={ATURAN}><AlertTriangle size={12} /> {ATURAN}</p>}
    </Kartu>
  );
}
