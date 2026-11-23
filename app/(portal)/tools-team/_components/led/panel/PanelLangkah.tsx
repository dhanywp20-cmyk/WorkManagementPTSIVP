'use client';
import { useState } from 'react';
import type React from 'react';
import { ArrowRight, Cable, ChevronDown, FileDown, Image as IkonGambar, Zap } from 'lucide-react';
import { Angka, TombolSalin } from '../../bersama/ui';
import { KartuProject } from './KartuProject';
import { KartuSpesifikasi } from './KartuSpesifikasi';
import type { AlatLED } from './alat';

function Langkah({ no, judul, ket, buka, onAlih, children }: {
  no: number; judul: string; ket?: string; buka: boolean; onAlih: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button type="button" onClick={onAlih} aria-expanded={buka}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-100/80 hover:bg-slate-100 text-left">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-blue-700 text-white text-[11px] font-extrabold shrink-0">{no}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-800">Langkah {no}: {judul}</span>
          {!buka && ket && <span className="block text-[11.5px] text-slate-500 truncate">{ket}</span>}
        </span>
        <ChevronDown size={16} className={`text-slate-500 transition-transform ${buka ? 'rotate-180' : ''}`} />
      </button>
      {buka && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

function TautanSub({ ikon, judul, ket, nada, onKlik }: { ikon: React.ReactNode; judul: string; ket: string; nada: 'biru' | 'kuning'; onKlik: () => void }) {
  const warna = nada === 'biru' ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800' : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900';
  return (
    <button type="button" onClick={onKlik} className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left ${warna}`}>
      <span className="inline-flex items-center gap-2 text-[12.5px] font-bold">{ikon} {judul}</span>
      <span className="inline-flex items-center gap-1 text-[11.5px]">{ket} <ArrowRight size={13} /></span>
    </button>
  );
}

export function PanelLangkah({ a }: { a: AlatLED }) {
  const { customer, dayaLED, h, kolom, baris, labelLED, pindah, project, ruang, setRuang, sirkuitTotal, tKon } = a.K;
  const { cetak, pngLED, ringkasan } = a.E;
  const [buka, setBuka] = useState([true, true, true]);
  const alih = (i: number) => setBuka(b => b.map((x, j) => (j === i ? !x : x)));
  const ubahRuang = (x: Partial<typeof ruang>) => setRuang({ ...ruang, ...x });

  return (
    <aside className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <Langkah no={1} judul="Project & ruangan" ket={[project || 'Tanpa nama', customer, `dinding ${ruang.lebar}×${ruang.tinggi} m`].filter(Boolean).join(' · ')}
        buka={buka[0]} onAlih={() => alih(0)}>
        <KartuProject a={a} polos />
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 mt-5 mb-2">Ruangan</p>
        <div className="grid grid-cols-2 gap-3">
          <Angka label="Lebar dinding" nilai={ruang.lebar} satuan="m" onUbah={v => v > 0 && ubahRuang({ lebar: v })} />
          <Angka label="Tinggi dinding" nilai={ruang.tinggi} satuan="m" onUbah={v => v > 0 && ubahRuang({ tinggi: v })} />
          <Angka label="Layar dari lantai" nilai={ruang.elevasi} satuan="m" onUbah={v => v >= 0 && ubahRuang({ elevasi: v })} />
        </div>
        <p className="text-[11.5px] text-slate-500 mt-2">Hanya untuk gambar: dinding ikut membesar bila layar lebih besar.</p>
      </Langkah>
      <Langkah no={2} judul="Spesifikasi layar" ket={`${labelLED} · ${kolom} × ${baris}`} buka={buka[1]} onAlih={() => alih(1)}>
        <KartuSpesifikasi a={a} polos />
      </Langkah>
      <Langkah no={3} judul="Koneksi & ekspor" ket={`${h.resX} × ${h.resY} px · ${tKon.portTerpakai} port`} buka={buka[2]} onAlih={() => alih(2)}>
        <div className="space-y-2">
          <TautanSub ikon={<Cable size={15} />} judul="Screen Connection" ket={`${tKon.portTerpakai} port`} nada="biru" onKlik={() => pindah('koneksi')} />
          <TautanSub ikon={<Zap size={15} />} judul="Power Connection" ket={`${sirkuitTotal} × MCB ${dayaLED.mcb} A`} nada="kuning" onKlik={() => pindah('daya')} />
          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={cetak}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-[13px] font-bold px-4 py-2.5">
              <FileDown size={16} /> Ekspor ke PDF
            </button>
            <button type="button" onClick={() => void pngLED()} title="Unduh PNG"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50">
              <IkonGambar size={15} /> PNG
            </button>
            <TombolSalin teks={ringkasan} />
          </div>
        </div>
      </Langkah>
    </aside>
  );
}
