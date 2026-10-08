'use client';
/**
 * Audio · speaker line tegangan konstan 70 / 100 V: total tap → daya amplifier (cadangan 25%) &
 * impedansi beban, plus rugi kabel line. Rumus: lib/av-audio-jaringan.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, Segmen, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { amplifierLine, rugiKabel, saranKabel } from '@/lib/av-audio-jaringan';
import { useState } from 'react';

interface Tap { nama: string; watt: number; jumlah: number }
const AWAL: Tap[] = [{ nama: 'Speaker plafon', watt: 6, jumlah: 12 }, { nama: 'Speaker dinding', watt: 15, jumlah: 4 }];
const CATATAN = 'Line tegangan konstan: daya amplifier ≥ total tap + 25% (jangan membebani amplifier sampai 100%). Impedansi line = V² / total tap - tidak boleh di bawah impedansi minimum keluaran amplifier. Rugi kabel line dihitung ke impedansi line tersebut; batas umum ±1 dB (±20% daya).';

export function AudioLine() {
  const [tap, setTap] = useState<Tap[]>(AWAL);
  const [v, setV] = useState<'100' | '70'>('100');
  const [panjang, setPanjang] = useState(80);
  const [luas, setLuas] = useState(1.5);
  const tegangan = Number(v);
  const h = amplifierLine(tap, tegangan);
  const kabel = rugiKabel(panjang, luas, h.bebanOhm);
  const saran = saranKabel(panjang, h.bebanOhm, 1);
  const ubah = (i: number, x: Partial<Tap>) => setTap(t => t.map((a, j) => (j === i ? { ...a, ...x } : a)));
  const ringkas = () => [
    `*Line ${v} V*`, ...tap.map(t => `- ${t.nama}: ${t.jumlah} × ${t.watt} W`),
    `Total tap ${f(h.totalW, 0)} W → amplifier ≥ ${f(h.butuhW, 0)} W (saran ${h.ampW ?? '> 2000'} W), impedansi line ${f(h.bebanOhm, 1)} Ω`,
    `Kabel ${f(panjang, 0)} m ${luas} mm²: rugi ${f(kabel.rugiDb, 2)} dB (${f(kabel.hilangPersen, 1)}%)${saran ? `, saran ≥ ${saran} mm²` : ''}`,
  ].join('\n');
  const lembar = () => lembarAV(`Audio · Line ${v} V`,
    [['Tegangan line', `${v} V`], ['Jumlah speaker', String(h.jumlahSpeaker)], ['Kabel', `${f(panjang, 0)} m · ${luas} mm²`]],
    [['Total tap', `${f(h.totalW, 0)} W`], ['Amplifier minimum (+25%)', `${f(h.butuhW, 0)} W`], ['Amplifier saran', h.ampW ? `${h.ampW} W` : '> 2000 W (bagi zona)', true],
      ['Impedansi line', `${f(h.bebanOhm, 1)} Ω`], ['Rugi kabel', `${f(kabel.rugiDb, 2)} dB (${f(kabel.hilangPersen, 1)}%)`, true], ['Kabel saran (≤1 dB)', saran ? `≥ ${saran} mm²` : 'bagi zona / naikkan tegangan']],
    CATATAN,
    [{ judul: 'Daftar tap speaker', jenis: 'tabel', kepala: ['Speaker', 'Tap', 'Jumlah', 'Subtotal'], rataKanan: [1, 2, 3],
      isi: tap.map(t => [t.nama, `${t.watt} W`, String(t.jumlah), `${f(t.watt * t.jumlah, 0)} W`]) }]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start">
      <Kartu judul="Speaker & tap">
        <div className="space-y-2">
          <Segmen label="Tegangan line" nilai={v} onUbah={setV} opsi={[{ v: '100', l: '100 V' }, { v: '70', l: '70 V' }]} />
          {tap.map((t, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_64px_32px] gap-2 items-end">
              <label className="block min-w-0">
                {i === 0 && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Speaker</span>}
                <input value={t.nama} onChange={e => ubah(i, { nama: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
              </label>
              <Angka label={i === 0 ? 'Tap W' : ''} nilai={t.watt} onUbah={x => ubah(i, { watt: x })} />
              <Angka label={i === 0 ? 'Jml' : ''} nilai={t.jumlah} onUbah={x => ubah(i, { jumlah: Math.round(x) })} step={1} />
              <button type="button" aria-label={`Hapus ${t.nama}`} onClick={() => setTap(x => x.filter((_, j) => j !== i))}
                className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setTap(t => [...t, { nama: 'Speaker baru', watt: 10, jumlah: 1 }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah speaker</button>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Angka label="Panjang kabel (terjauh)" nilai={panjang} onUbah={x => x > 0 && setPanjang(x)} satuan="m" />
            <Angka label="Luas penampang" nilai={luas} onUbah={x => x > 0 && setLuas(x)} satuan="mm²" />
          </div>
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, `Line ${v}V`)} />}>
        <div className="grid grid-cols-2 gap-2.5">
          <Nilai label="Total tap" nilai={f(h.totalW, 0)} satuan="W" ket={`${h.jumlahSpeaker} speaker`} />
          <Nilai label="Amplifier saran" nilai={h.ampW ?? '> 2000'} satuan="W" ket={`min ${f(h.butuhW, 0)} W (+25%)`} nada={h.ampW ? 'baik' : 'awas'} />
          <Nilai label="Impedansi line" nilai={f(h.bebanOhm, 1)} satuan="Ω" />
          <Nilai label="Rugi kabel" nilai={f(kabel.rugiDb, 2)} satuan="dB" ket={`${f(kabel.hilangPersen, 1)}% daya`} nada={kabel.rugiDb > 1 ? 'buruk' : kabel.rugiDb > 0.5 ? 'awas' : 'baik'} />
          <Nilai label="Kabel saran" nilai={saran ? `≥ ${saran}` : '-'} satuan={saran ? 'mm²' : undefined} ket={saran ? 'rugi ≤ 1 dB' : 'bagi zona / naikkan tegangan'} />
        </div>
        <Catatan>{CATATAN}</Catatan>
      </Kartu>
    </div>
  );
}
