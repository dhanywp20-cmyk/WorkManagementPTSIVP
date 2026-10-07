'use client';
/** Kalkulator bandwidth sinyal video (resolusi, refresh, bit, chroma). */
import { Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../bersama/ui';
import { aksiLembar, lembarAV } from './lembar';
import { ANTARMUKA, bandwidthGbps, type Chroma } from '@/lib/av-hitung';
import { useState } from 'react';

const RESOLUSI = [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160], [4096, 2160], [7680, 4320]];

export function KalkulatorSinyal() {
  const [res, setRes] = useState('3840x2160');
  const [hz, setHz] = useState(60);
  const [bit, setBit] = useState(8);
  const [chroma, setChroma] = useState<Chroma>('4:4:4');
  const [lebar, tinggi] = res.split('x').map(Number);
  const b = bandwidthGbps(lebar, tinggi, hz, bit, chroma);
  const ringkas = () => `${lebar}×${tinggi} @${hz}Hz ${bit}-bit ${chroma}: ±${f(b.dataGbps, 2)} Gbps. Cocok: ${ANTARMUKA.filter(a => a.gbps >= b.dataGbps).map(a => a.nama).join(', ') || 'tidak ada (butuh kompresi DSC)'}.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Format sinyal">
        <div className="grid grid-cols-2 gap-3">
          <Pilih label="Resolusi" nilai={res} onUbah={setRes} opsi={RESOLUSI.map(([w, h]) => ({ v: `${w}x${h}`, l: `${w} × ${h}` }))} />
          <Pilih label="Refresh" nilai={hz} onUbah={setHz} opsi={[24, 30, 50, 60, 120, 144].map(v => ({ v, l: `${v} Hz` }))} />
          <Pilih label="Bit depth" nilai={bit} onUbah={setBit} opsi={[8, 10, 12].map(v => ({ v, l: `${v}-bit` }))} />
          <Pilih label="Chroma" nilai={chroma} onUbah={setChroma} opsi={(['4:4:4', '4:2:2', '4:2:0'] as Chroma[]).map(v => ({ v, l: v }))} />
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => lembarAV('Bandwidth Sinyal Video',
        [['Resolusi', `${lebar} × ${tinggi}`], ['Refresh', `${hz} Hz`], ['Bit depth / chroma', `${bit}-bit · ${chroma}`]],
        [['Data video', `${f(b.dataGbps, 2)} Gbps`, true], ['Pixel clock', `${f(b.pixelClockMHz, 1)} MHz`]],
        'Timing standar termasuk blanking. Extender/matrix dengan kompresi (DSC, VC-2) bisa membawa format di atas kapasitas murninya.',
        [{ judul: 'Kecocokan antarmuka', jenis: 'tabel', kepala: ['Antarmuka', 'Kapasitas', 'Status', 'Panjang kabel'], rataKanan: [1],
          isi: ANTARMUKA.map(a => [a.nama, `${a.gbps} Gbps`, a.gbps >= b.dataGbps ? 'Cukup' : 'Tidak cukup', a.panjang]) }]), 'Bandwidth Sinyal')} />}>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Nilai label="Data video" nilai={f(b.dataGbps, 2)} satuan="Gbps" />
          <Nilai label="Pixel clock" nilai={f(b.pixelClockMHz, 1)} satuan="MHz" />
        </div>
        <ul className="divide-y divide-slate-100">
          {ANTARMUKA.map(a => {
            const ok = a.gbps >= b.dataGbps;
            return (
              <li key={a.nama} className="py-2 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800">{a.nama}</span>
                  <span className="block text-[11.5px] text-slate-500">{a.panjang}</span>
                </span>
                <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {ok ? 'Cukup' : 'Tidak cukup'} · {a.gbps} Gbps
                </span>
              </li>
            );
          })}
        </ul>
        <Catatan>Perhitungan memakai timing standar (termasuk blanking). Extender/matrix tertentu memakai kompresi (DSC, VC-2) sehingga bisa membawa format di atas kapasitas murninya - cek spesifikasi perangkat.</Catatan>
      </Kartu>
    </div>
  );
}

/* ── Audio ───────────────────────────────────────────────────────────── */
