'use client';
/**
 * Kalkulator PoE: perangkat (kamera, mic, panel sentuh, AP, encoder) → jumlah port, anggaran daya PoE
 * (+20%), kelas tertinggi, saran switch; menandai perangkat yang melebihi kelas port-nya.
 * Rumus: lib/av-audio-jaringan.ts (hitungPoE).
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../bersama/ui';
import { aksiLembar, lembarAV } from './lembar';
import { hitungPoE, KELAS_POE, type KodePoE } from '@/lib/av-audio-jaringan';
import { useState } from 'react';
import { angkaDari, teksDari } from '@/lib/pustaka';
import { PilihPustaka } from '../pustaka/PilihPustaka';

interface PerangkatPoE { nama: string; watt: number; jumlah: number; kelas: KodePoE }
const AWAL: PerangkatPoE[] = [
  { nama: 'Kamera PTZ', watt: 25, jumlah: 2, kelas: 'at' },
  { nama: 'Ceiling mic array', watt: 12, jumlah: 2, kelas: 'af' },
  { nama: 'Touch panel', watt: 10, jumlah: 1, kelas: 'af' },
  { nama: 'Wireless AP', watt: 20, jumlah: 1, kelas: 'at' },
];
const namaKelas = (k: KodePoE) => KELAS_POE.find(x => x.v === k)!.l;
const CATATAN = 'Watt = konsumsi maksimum perangkat dari datasheet (bukan kelasnya). Anggaran PoE switch ≥ total + 20%. Tiap port harus mendukung kelas perangkatnya (af 15,4 W · at 30 W · bt 60/90 W di sisi switch); kabel ≤ 100 m.';

export function KalkulatorPoE() {
  const [daftar, setDaftar] = useState<PerangkatPoE[]>(AWAL);
  const h = hitungPoE(daftar);
  const ubah = (i: number, x: Partial<PerangkatPoE>) => setDaftar(a => a.map((v, j) => (j === i ? { ...v, ...x } : v)));
  const ringkas = () => [
    '*Kebutuhan PoE*', ...daftar.map(d => `- ${d.nama}: ${d.jumlah} × ${d.watt} W (${namaKelas(d.kelas)})`),
    `${h.port} port, total ${f(h.totalW, 1)} W → anggaran ≥ ${f(h.butuhW, 0)} W (switch ${h.portSwitch ?? '> 48'} port, PoE ${h.anggaranW ?? '> 740'} W${h.kelasTertinggi ? `, ${namaKelas(h.kelasTertinggi)}` : ''})`,
    ...(h.melebihi.length ? [`PERHATIAN: ${h.melebihi.map(m => m.nama).join(', ')} melebihi daya kelas port-nya`] : []),
  ].join('\n');
  const lembar = () => lembarAV('Kebutuhan PoE',
    [['Jumlah perangkat', String(h.port)]],
    [['Total daya', `${f(h.totalW, 1)} W`], ['Anggaran PoE minimum (+20%)', `${f(h.butuhW, 0)} W`, true], ['Switch saran', `${h.portSwitch ?? '> 48'} port · PoE ${h.anggaranW ?? '> 740'} W`, true],
      ['Kelas tertinggi', h.kelasTertinggi ? namaKelas(h.kelasTertinggi) : '-']],
    CATATAN,
    [{ judul: 'Daftar perangkat', jenis: 'tabel', kepala: ['Perangkat', 'Watt', 'Jumlah', 'Kelas port', 'Subtotal'], rataKanan: [1, 2, 4],
      isi: daftar.map(d => [d.nama, `${d.watt} W`, String(d.jumlah), namaKelas(d.kelas), `${f(d.watt * d.jumlah, 1)} W`]) }]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start">
      <Kartu judul="Perangkat PoE">
        <div className="space-y-2">
          {daftar.map((d, i) => {
            const lewat = d.watt > KELAS_POE.find(k => k.v === d.kelas)!.w;
            return (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_52px_minmax(0,150px)_32px] gap-1.5 items-end">
                <label className="block min-w-0">
                  {i === 0 && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Perangkat</span>}
                  <input value={d.nama} onChange={e => ubah(i, { nama: e.target.value })} className={`w-full rounded-xl border px-3 py-2 text-base sm:text-sm ${lewat ? 'border-rose-400' : 'border-slate-200'}`} />
                </label>
                <Angka label={i === 0 ? 'Watt' : ''} nilai={d.watt} onUbah={v => ubah(i, { watt: v })} />
                <Angka label={i === 0 ? 'Jml' : ''} nilai={d.jumlah} onUbah={v => ubah(i, { jumlah: Math.round(v) })} step={1} />
                <Pilih label={i === 0 ? 'Kelas port' : ''} nilai={d.kelas} onUbah={v => ubah(i, { kelas: v })} opsi={KELAS_POE.map(k => ({ v: k.v as KodePoE, l: `${k.l} ${k.w} W` }))} />
                <button type="button" aria-label={`Hapus ${d.nama}`} onClick={() => setDaftar(a => a.filter((_, j) => j !== i))}
                  className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
              </div>
            );
          })}
          <button type="button" onClick={() => setDaftar(a => [...a, { nama: 'Perangkat baru', watt: 10, jumlah: 1, kelas: 'af' }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah perangkat</button>
          <PilihPustaka jenis="perangkat-poe" label="Tambah perangkat dari Pustaka" onPilih={e => {
            const k = teksDari(e, 'kelas'); const kelas = (KELAS_POE.some(x => x.v === k) ? k : 'af') as KodePoE;
            setDaftar(a => [...a, { nama: e.nama, watt: angkaDari(e, 'watt'), jumlah: 1, kelas }]);
          }} />
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Kebutuhan PoE')} />}>
        <div className="grid grid-cols-2 gap-2.5">
          <Nilai label="Port PoE" nilai={h.port} ket={`switch ${h.portSwitch ?? '> 48'} port`} />
          <Nilai label="Total daya" nilai={f(h.totalW, 1)} satuan="W" />
          <Nilai label="Anggaran PoE" nilai={h.anggaranW ?? '> 740'} satuan="W" ket={`min ${f(h.butuhW, 0)} W (+20%)`} nada={h.anggaranW ? 'baik' : 'awas'} />
          <Nilai label="Kelas tertinggi" nilai={h.kelasTertinggi ? namaKelas(h.kelasTertinggi) : '-'} />
        </div>
        {h.melebihi.length > 0 && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">
            {h.melebihi.map(m => m.nama).join(', ')} membutuhkan daya di atas kelas port yang dipilih - perangkat tidak akan menyala stabil.
          </p>
        )}
        <Catatan>{CATATAN}</Catatan>
      </Kartu>
    </div>
  );
}
