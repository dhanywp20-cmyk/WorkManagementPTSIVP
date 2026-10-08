'use client';
/**
 * Kalkulator rak: total U perangkat + ventilasi + cadangan → ukuran rak standar, berat, daya & panas.
 * Rumus: lib/av-audio-jaringan.ts (hitungRak).
 */
import { Angka, Catatan, f, Kartu, Nilai, TombolSalin } from '../bersama/ui';
import { aksiLembar, lembarAV } from './lembar';
import { hitungRak, type ItemRak } from '@/lib/av-audio-jaringan';
import { useState } from 'react';

const AWAL: ItemRak[] = [
  { nama: 'Switcher / matrix HDMI', u: 1, kg: 4, watt: 60, jumlah: 1 },
  { nama: 'DSP audio', u: 1, kg: 4, watt: 40, jumlah: 1 },
  { nama: 'Amplifier 4 kanal', u: 2, kg: 9, watt: 400, jumlah: 1 },
  { nama: 'Network switch PoE', u: 1, kg: 4, watt: 200, jumlah: 1 },
  { nama: 'PDU', u: 1, kg: 2, watt: 0, jumlah: 1 },
];
const CATATAN = 'Ventilasi: 1U kosong (blank vent panel) di atas tiap perangkat panas (≥ 150 W). Cadangan 25% untuk penambahan perangkat & manajemen kabel. Periksa kapasitas beban rak & lantai, dan sediakan PDU dengan jumlah outlet yang cukup.';

export function KalkulatorRak() {
  const [item, setItem] = useState<ItemRak[]>(AWAL);
  const [cadangan, setCadangan] = useState(25);
  const [ventilasi, setVentilasi] = useState(true);
  const h = hitungRak(item, cadangan, ventilasi);
  const ubah = (i: number, x: Partial<ItemRak>) => setItem(a => a.map((v, j) => (j === i ? { ...v, ...x } : v)));
  const ringkas = () => [
    '*Kebutuhan rak*', ...item.map(x => `- ${x.nama}: ${x.jumlah} × ${x.u}U`),
    `Perangkat ${h.uPerangkat}U + ventilasi ${h.uVentilasi}U + ${cadangan}% → ${h.uButuh}U → rak ${h.rakU ?? '> 47'}U`,
    `Berat ±${f(h.beratKg, 0)} kg, daya ${f(h.watt, 0)} W, panas ±${f(h.btu, 0)} BTU/jam`,
  ].join('\n');
  const lembar = () => lembarAV('Kebutuhan Rak',
    [['Jumlah perangkat', String(item.reduce((n, x) => n + x.jumlah, 0))], ['Cadangan', `${cadangan}%`], ['Ventilasi', ventilasi ? '1U per perangkat ≥ 150 W' : 'tidak']],
    [['U perangkat', `${h.uPerangkat}U`], ['U ventilasi', `${h.uVentilasi}U`], ['U dibutuhkan', `${h.uButuh}U`], ['Ukuran rak', h.rakU ? `${h.rakU}U` : '> 47U (2 rak)', true],
      ['Berat isi', `±${f(h.beratKg, 0)} kg`], ['Daya / panas', `${f(h.watt, 0)} W · ±${f(h.btu, 0)} BTU/jam`, true]],
    CATATAN,
    [{ judul: 'Daftar perangkat', jenis: 'tabel', kepala: ['Perangkat', 'U', 'Jumlah', 'Berat', 'Daya'], rataKanan: [1, 2, 3, 4],
      isi: item.map(x => [x.nama, `${x.u}U`, String(x.jumlah), `${f(x.kg * x.jumlah, 1)} kg`, `${f(x.watt * x.jumlah, 0)} W`]) }]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start">
      <Kartu judul="Perangkat di rak">
        <div className="space-y-2">
          {item.map((x, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_52px_60px_64px_52px_32px] gap-1.5 items-end">
              <label className="block min-w-0">
                {i === 0 && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Perangkat</span>}
                <input value={x.nama} onChange={e => ubah(i, { nama: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
              </label>
              <Angka label={i === 0 ? 'U' : ''} nilai={x.u} onUbah={v => ubah(i, { u: Math.round(v) })} step={1} />
              <Angka label={i === 0 ? 'Kg' : ''} nilai={x.kg} onUbah={v => ubah(i, { kg: v })} />
              <Angka label={i === 0 ? 'Watt' : ''} nilai={x.watt} onUbah={v => ubah(i, { watt: v })} />
              <Angka label={i === 0 ? 'Jml' : ''} nilai={x.jumlah} onUbah={v => ubah(i, { jumlah: Math.round(v) })} step={1} />
              <button type="button" aria-label={`Hapus ${x.nama}`} onClick={() => setItem(a => a.filter((_, j) => j !== i))}
                className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setItem(a => [...a, { nama: 'Perangkat baru', u: 1, kg: 3, watt: 50, jumlah: 1 }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah perangkat</button>
          <div className="grid grid-cols-2 gap-3 pt-2 items-end">
            <Angka label="Cadangan" nilai={cadangan} onUbah={v => v >= 0 && setCadangan(v)} satuan="%" />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2">
              <input type="checkbox" checked={ventilasi} onChange={e => setVentilasi(e.target.checked)} className="w-4 h-4" /> 1U ventilasi per perangkat panas
            </label>
          </div>
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Kebutuhan Rak')} />}>
        <div className="grid grid-cols-2 gap-2.5">
          <Nilai label="U dibutuhkan" nilai={h.uButuh} satuan="U" ket={`${h.uPerangkat}U + ${h.uVentilasi}U vent + ${cadangan}%`} />
          <Nilai label="Ukuran rak" nilai={h.rakU ?? '> 47'} satuan="U" nada={h.rakU ? 'baik' : 'awas'} ket={h.rakU ? 'standar terdekat' : 'bagi ke 2 rak'} />
          <Nilai label="Berat isi" nilai={f(h.beratKg, 0)} satuan="kg" />
          <Nilai label="Daya" nilai={f(h.watt, 0)} satuan="W" ket={`±${f(h.btu, 0)} BTU/jam`} />
        </div>
        <Catatan>{CATATAN}</Catatan>
      </Kartu>
    </div>
  );
}
