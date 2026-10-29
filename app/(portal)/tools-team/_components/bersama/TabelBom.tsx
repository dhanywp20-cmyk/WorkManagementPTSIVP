'use client';
/** Tabel daftar material (BOM) dengan isian harga satuan & total penawaran - dipakai LED dan Videowall / IFP. */
import type React from 'react';
import type { BarisBOM } from '@/lib/av-hitung-bom';
import { rupiah } from './cetak';

export function TabelBom({ baris, harga, setHarga, ppn, nilai }: {
  baris: BarisBOM[]; harga: Record<string, number>;
  setHarga: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  ppn: number; nilai: { subtotal: number; ppn: number; total: number };
}) {
  const adaHarga = baris.some(b => (harga[b.kunci] ?? 0) > 0);
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12.5px] min-w-[560px]">
        <thead className="text-slate-600 bg-slate-50">
          <tr>
            <th className="text-left font-bold px-2 py-2">Item</th>
            <th className="text-right font-bold px-2 py-2">Qty</th>
            <th className="text-right font-bold px-2 py-2 w-36">Harga satuan (Rp)</th>
            <th className="text-right font-bold px-2 py-2">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {baris.map(b => (
            <tr key={b.kunci} className="border-t border-slate-100 align-top">
              <td className="px-2 py-1.5"><span className="font-semibold text-slate-800">{b.item}</span>{b.ket && <span className="block text-[11px] text-slate-500">{b.ket}</span>}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{b.qty.toLocaleString('id-ID')} <span className="text-slate-500">{b.satuan}</span></td>
              <td className="px-2 py-1">
                <input type="number" inputMode="numeric" min={0} step={1000} aria-label={`Harga satuan ${b.item}`} value={harga[b.kunci] ?? ''} placeholder="0"
                  onChange={e => { const v = Math.max(0, Number(e.target.value) || 0); setHarga(hg => { const baru = { ...hg }; if (v > 0) baru[b.kunci] = v; else delete baru[b.kunci]; return baru; }); }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[12.5px] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-200" />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{harga[b.kunci] ? rupiah(harga[b.kunci] * b.qty) : '—'}</td>
            </tr>
          ))}
        </tbody>
        {adaHarga && (
          <tfoot className="border-t-2 border-slate-200">
            <tr><td colSpan={3} className="px-2 py-1 text-right text-slate-600">Subtotal</td><td className="px-2 py-1 text-right tabular-nums">{rupiah(nilai.subtotal)}</td></tr>
            <tr><td colSpan={3} className="px-2 py-1 text-right text-slate-600">PPN {ppn}%</td><td className="px-2 py-1 text-right tabular-nums">{rupiah(nilai.ppn)}</td></tr>
            <tr><td colSpan={3} className="px-2 py-1.5 text-right font-extrabold text-slate-900">Total</td><td className="px-2 py-1.5 text-right tabular-nums font-extrabold text-blue-800">{rupiah(nilai.total)}</td></tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Baris tabel lembar cetak BOM / penawaran (kolom harga hanya bila ada harga). */
export function isiLembarBom(baris: BarisBOM[], harga: Record<string, number>, ppn: number, nilai: { subtotal: number; ppn: number; total: number }) {
  const adaHarga = baris.some(b => (harga[b.kunci] ?? 0) > 0);
  return {
    kepala: adaHarga ? ['No', 'Item', 'Qty', 'Satuan', 'Harga satuan', 'Jumlah', 'Keterangan'] : ['No', 'Item', 'Qty', 'Satuan', 'Keterangan'],
    rataKanan: adaHarga ? [0, 2, 4, 5] : [0, 2],
    isi: [
      ...baris.map((b, i) => adaHarga
        ? [String(i + 1), b.item, b.qty.toLocaleString('id-ID'), b.satuan, harga[b.kunci] ? rupiah(harga[b.kunci]) : '—', harga[b.kunci] ? rupiah(harga[b.kunci] * b.qty) : '—', b.ket]
        : [String(i + 1), b.item, b.qty.toLocaleString('id-ID'), b.satuan, b.ket]),
      ...(adaHarga ? [
        ['', 'Subtotal', '', '', '', rupiah(nilai.subtotal), ''],
        ['', `PPN ${ppn}%`, '', '', '', rupiah(nilai.ppn), ''],
        ['', 'TOTAL', '', '', '', rupiah(nilai.total), ''],
      ] : []),
    ],
  };
}

/** Baris BOM sebagai teks WA (dengan harga bila diisi). */
export function teksBarisBom(baris: BarisBOM[], harga: Record<string, number>, ppn: number, nilai: { subtotal: number; ppn: number; total: number }) {
  const adaHarga = baris.some(b => (harga[b.kunci] ?? 0) > 0);
  return [
    ...baris.map((b, i) => `${i + 1}. ${b.item}: ${b.qty} ${b.satuan}${harga[b.kunci] ? ` × ${rupiah(harga[b.kunci])} = ${rupiah(harga[b.kunci] * b.qty)}` : ''}${b.ket ? ` (${b.ket})` : ''}`),
    ...(adaHarga ? [`Subtotal ${rupiah(nilai.subtotal)} · PPN ${ppn}% ${rupiah(nilai.ppn)} · *Total ${rupiah(nilai.total)}*`] : []),
  ];
}
