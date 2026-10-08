'use client';
/** Kalkulator daya & panas perangkat (VA, arus, BTU). */
import { Angka, Catatan, f, Kartu, Nilai, TombolSalin } from '../bersama/ui';
import { aksiLembar, lembarAV } from './lembar';
import { type Beban, hitungDaya } from '@/lib/av-hitung';
import { runtimeUPSMenit } from '@/lib/av-audio-jaringan';
import { useMemo, useState } from 'react';

const BEBAN_AWAL: Beban[] = [
  { nama: 'Display / TV 86"', watt: 400, jumlah: 1 },
  { nama: 'Video conference bar', watt: 60, jumlah: 1 },
  { nama: 'DSP / amplifier', watt: 150, jumlah: 1 },
  { nama: 'Switcher / matrix', watt: 50, jumlah: 1 },
];

export function KalkulatorDaya() {
  const [beban, setBeban] = useState<Beban[]>(BEBAN_AWAL);
  const [tegangan, setTegangan] = useState(220);
  const [pf, setPf] = useState(0.9);
  const h = useMemo(() => hitungDaya(beban, tegangan, pf), [beban, tegangan, pf]);
  //  Lama cadangan UPS dari baterai terpasang (perkiraan; pakai tabel runtime pabrikan untuk angka pasti).
  const [batV, setBatV] = useState(12); const [batAh, setBatAh] = useState(9); const [batN, setBatN] = useState(2);
  const runtime = runtimeUPSMenit(h.totalW, batV, batAh, batN);
  const ubah = (i: number, x: Partial<Beban>) => setBeban(b => b.map((v, j) => (j === i ? { ...v, ...x } : v)));
  const ringkas = () => [
    '*Beban daya perangkat AV*',
    ...beban.map(b => `- ${b.nama}: ${b.jumlah} × ${b.watt} W`),
    `Total ${f(h.totalW, 0)} W (${f(h.va, 0)} VA), arus ${f(h.arusA, 1)} A @${tegangan}V, MCB ${h.mcbA} A`,
    `UPS saran ${f(h.upsVA, 0)} VA; panas ±${f(h.btu, 0)} BTU/jam (±${f(h.pkAC, 1)} PK)`,
    `Baterai ${batN} × ${batV} V ${batAh} Ah → cadangan ±${f(runtime, 0)} menit`,
  ].join('\n');
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start">
      <Kartu judul="Daftar perangkat">
        <div className="space-y-2">
          {beban.map((b, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_64px_32px] gap-2 items-end">
              <label className="block min-w-0">
                {i === 0 && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Perangkat</span>}
                <input value={b.nama} onChange={e => ubah(i, { nama: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
              </label>
              <Angka label={i === 0 ? 'Watt' : ''} nilai={b.watt} onUbah={v => ubah(i, { watt: v })} />
              <Angka label={i === 0 ? 'Jml' : ''} nilai={b.jumlah} onUbah={v => ubah(i, { jumlah: Math.round(v) })} step={1} />
              <button type="button" aria-label={`Hapus ${b.nama}`} onClick={() => setBeban(x => x.filter((_, j) => j !== i))}
                className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setBeban(b => [...b, { nama: 'Perangkat baru', watt: 100, jumlah: 1 }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah perangkat</button>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Angka label="Tegangan" nilai={tegangan} onUbah={v => v > 0 && setTegangan(v)} satuan="V" />
            <Angka label="Power factor" nilai={pf} onUbah={v => v > 0.3 && v <= 1 && setPf(v)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Angka label="Baterai UPS" nilai={batV} onUbah={v => v > 0 && setBatV(v)} satuan="V" />
            <Angka label="Kapasitas" nilai={batAh} onUbah={v => v > 0 && setBatAh(v)} satuan="Ah" />
            <Angka label="Jumlah" nilai={batN} onUbah={v => v >= 1 && setBatN(Math.round(v))} step={1} />
          </div>
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => lembarAV('Daya, UPS & Panas Perangkat AV',
        [['Tegangan', `${tegangan} V`], ['Power factor', f(pf)], ['Jumlah perangkat', String(beban.reduce((a, b) => a + b.jumlah, 0))]],
        [['Total daya', `${f(h.totalW, 0)} W · ${f(h.va, 0)} VA`, true], [`Arus @${tegangan} V`, `${f(h.arusA, 1)} A · MCB ${h.mcbA} A`], ['UPS saran', `${f(h.upsVA, 0)} VA (+25%)`, true], ['Cadangan UPS', `±${f(runtime, 0)} menit (${batN} × ${batV} V ${batAh} Ah)`], ['Panas', `±${f(h.btu, 0)} BTU/jam (±${f(h.pkAC, 1)} PK)`]],
        'Gunakan daya maksimum dari datasheet. Kebutuhan AC ruangan juga dipengaruhi jumlah orang, kaca, dan luas ruang.',
        [{ judul: 'Daftar perangkat', jenis: 'tabel', kepala: ['Perangkat', 'Watt', 'Jumlah', 'Subtotal'], rataKanan: [1, 2, 3],
          isi: beban.map(b => [b.nama, `${b.watt} W`, String(b.jumlah), `${f(b.watt * b.jumlah, 0)} W`]) }]), 'Daya AV')} />}>
        <div className="grid grid-cols-2 gap-2.5">
          <Nilai label="Total daya" nilai={f(h.totalW, 0)} satuan="W" ket={`${f(h.va, 0)} VA`} />
          <Nilai label={`Arus @${tegangan}V`} nilai={f(h.arusA, 1)} satuan="A" ket={`MCB ${h.mcbA} A`} />
          <Nilai label="UPS saran" nilai={f(h.upsVA, 0)} satuan="VA" ket="+25% cadangan" />
          <Nilai label="Panas" nilai={f(h.btu, 0)} satuan="BTU/h" ket={`±${f(h.pkAC, 1)} PK AC (perangkat saja)`} />
          <Nilai label="Cadangan UPS" nilai={Number.isFinite(runtime) ? f(runtime, 0) : '-'} satuan="menit" ket={`${batN} × ${batV} V ${batAh} Ah · efisiensi 85%, DoD 80%`} nada={runtime < 10 ? 'awas' : 'baik'} />
        </div>
        <Catatan>Gunakan daya maksimum dari datasheet. Kebutuhan AC ruangan juga dipengaruhi jumlah orang, kaca, dan luas ruang.</Catatan>
      </Kartu>
    </div>
  );
}
