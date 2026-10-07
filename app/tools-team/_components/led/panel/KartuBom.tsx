'use client';
/** Kartu daftar material (BOM) & penawaran dengan harga satuan. */
import { bukaCetak, namaBerkas, unduhLembarPNG } from '../../bersama/cetak';
import { Angka, Catatan, Kartu, TombolSalin } from '../../bersama/ui';
import { rupiah } from '../data';
import type { AlatLED } from './alat';

export function KartuBom({ a }: { a: AlatLED }) {
  const { adaHarga, barisBom, bom, customer, hanyaLihat, harga, labelLED, namaUnit, nilaiPenawaran, project, satuan, setBom, setHarga } = a.K;
  const { lembarBom, teksBom } = a.E;
  return (
    <>
      <Kartu judul={adaHarga ? 'Daftar material & penawaran' : 'Daftar material (BOM)'}
        aksi={<TombolSalin teks={teksBom} onCetak={() => bukaCetak(lembarBom())} onPng={() => unduhLembarPNG(lembarBom(), namaBerkas(adaHarga ? 'Penawaran LED' : 'BOM LED', labelLED, project, customer))} />}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          <Angka label={`Spare ${namaUnit}`} nilai={bom.cadanganUnit} satuan="%" step={0.5} onUbah={v => v >= 0 && v <= 50 && setBom({ ...bom, cadanganUnit: v })} />
          <Angka label="Spare RC & PSU" nilai={bom.cadanganRC} satuan="%" step={0.5} onUbah={v => v >= 0 && v <= 50 && setBom({ ...bom, cadanganRC: v })} />
          {satuan === 'modul' && namaUnit === 'modul' && <Angka label="Power supply" nilai={bom.psuW} satuan="W" step={10} onUbah={v => v >= 50 && v <= 1000 && setBom({ ...bom, psuW: v })} />}
          <Angka label="Kabel LAN ke layar" nilai={bom.panjangLAN} satuan="m" onUbah={v => v >= 1 && setBom({ ...bom, panjangLAN: v })} />
          <Angka label="PPN" nilai={bom.ppn} satuan="%" onUbah={v => v >= 0 && v <= 30 && setBom({ ...bom, ppn: v })} />
        </div>
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
              {barisBom.map(b => (
                <tr key={b.kunci} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-1.5"><span className="font-semibold text-slate-800">{b.item}</span>{b.ket && <span className="block text-[11px] text-slate-500">{b.ket}</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{b.qty.toLocaleString('id-ID')} <span className="text-slate-500">{b.satuan}</span></td>
                  <td className="px-2 py-1">
                    <input type="number" inputMode="numeric" min={0} step={1000} aria-label={`Harga satuan ${b.item}`} value={harga[b.kunci] ?? ''} placeholder="0"
                      onChange={e => { const v = Math.max(0, Number(e.target.value) || 0); setHarga(hg => { const baru = { ...hg }; if (v > 0) baru[b.kunci] = v; else delete baru[b.kunci]; return baru; }); }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{harga[b.kunci] ? rupiah(harga[b.kunci] * b.qty) : '—'}</td>
                </tr>
              ))}
            </tbody>
            {adaHarga && (
              <tfoot className="border-t-2 border-slate-200">
                <tr><td colSpan={3} className="px-2 py-1 text-right text-slate-600">Subtotal</td><td className="px-2 py-1 text-right tabular-nums">{rupiah(nilaiPenawaran.subtotal)}</td></tr>
                <tr><td colSpan={3} className="px-2 py-1 text-right text-slate-600">PPN {bom.ppn}%</td><td className="px-2 py-1 text-right tabular-nums">{rupiah(nilaiPenawaran.ppn)}</td></tr>
                <tr><td colSpan={3} className="px-2 py-1.5 text-right font-extrabold text-slate-900">Total</td><td className="px-2 py-1.5 text-right tabular-nums font-extrabold text-blue-800">{rupiah(nilaiPenawaran.total)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
        <Catatan>Receiving card & port dari Screen Connection, sirkuit & MCB dari Power Connection. Isi harga satuan untuk membuat lembar penawaran (harga ikut tersimpan bersama hitungan{hanyaLihat ? '' : ' saat Simpan'}).</Catatan>
      </Kartu>
    </>
  );
}
