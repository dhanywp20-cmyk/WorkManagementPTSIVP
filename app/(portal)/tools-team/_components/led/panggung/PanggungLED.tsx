'use client';
import { useId, useMemo, useState } from 'react';
import type React from 'react';
import { Image as IkonGambar, Minus, PersonStanding, Plus, RotateCcw, Ruler } from 'lucide-react';
import { f } from '../../bersama/ui';
import { RUANG_AWAL } from '../ruang';
import type { AlatLED } from '../panel/alat';
import { GambarPanggung, type KontenPanggung, type OpsiGambar } from './GambarPanggung';
import { susunPanggung, teksUkur, VB_W } from './geometri';

function TombolAlat({ label, aktif, onKlik, children }: { label: string; aktif?: boolean; onKlik: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onKlik} aria-pressed={aktif} title={label} className="group flex flex-col items-center gap-1 w-14">
      <span className={`grid place-items-center w-9 h-9 rounded-full border transition-colors ${aktif ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-300 bg-white text-blue-700 group-hover:bg-blue-50'}`}>
        {children}
      </span>
      <span className="text-[10.5px] font-semibold text-slate-600 leading-none">{label}</span>
    </button>
  );
}

function Langkah({ x, y, vbH, nilai, sub, onKurang, onTambah, judul }: {
  x: number; y: number; vbH: number; nilai: string; sub: string; onKurang: () => void; onTambah: () => void; judul: string;
}) {
  const kelas = 'grid place-items-center w-7 h-full text-slate-600 hover:bg-slate-100 hover:text-blue-700 disabled:opacity-40';
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-stretch h-9 rounded-lg border border-slate-300 bg-white shadow-sm"
      style={{ left: `${(x / VB_W) * 100}%`, top: `${(y / vbH) * 100}%` }} role="group" aria-label={judul}>
      <button type="button" onClick={onKurang} aria-label={`Kurangi ${judul}`} className={`${kelas} rounded-l-lg`}><Minus size={13} /></button>
      <span className="flex flex-col justify-center px-1.5 text-center min-w-[64px]">
        <span className="text-[12.5px] font-bold text-slate-900 tabular-nums leading-tight">{nilai}</span>
        <span className="text-[10px] text-slate-500 leading-tight">{sub}</span>
      </span>
      <button type="button" onClick={onTambah} aria-label={`Tambah ${judul}`} className={`${kelas} rounded-r-lg`}><Plus size={13} /></button>
    </div>
  );
}

function Statistik({ label, nilai, ket }: { label: string; nilai: React.ReactNode; ket?: string }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-[15px] font-extrabold text-slate-900 tabular-nums leading-tight mt-0.5 truncate">{nilai}</p>
      {ket && <p className="text-[11px] text-slate-500 truncate">{ket}</p>}
    </div>
  );
}

export function PanggungLED({ a }: { a: AlatLED }) {
  const K = a.K;
  const { baris, h, kolom, layarTurunan, mode, multi, namaLayar, namaUnit, ruang, u } = K;
  const [o, setO] = useState<OpsiGambar>({ penggaris: true, satuan: 'm', konten: 'contoh', orang: true });
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const layar = useMemo(() => [
    { nama: namaLayar || 'Screen 1', lebar: h.lebarM, tinggi: h.tinggiM, kolom, baris },
    ...layarTurunan.map(x => ({ nama: x.l.nama, lebar: x.h.lebarM, tinggi: x.h.tinggiM, kolom: x.kolom, baris: x.baris })),
  ], [namaLayar, h.lebarM, h.tinggiM, kolom, baris, layarTurunan]);
  const p = useMemo(() => susunPanggung(layar, ruang), [layar, ruang]);
  const k = p.kotak[0];

  const ubahKolom = (d: number) => {
    const baru = Math.max(1, kolom + d);
    if (mode === 'jumlah') K.setKolomIn(baru); else K.setTargetW((baru * u.w) / 1000);
  };
  const ubahBaris = (d: number) => {
    const baru = Math.max(1, baris + d);
    if (mode === 'jumlah') K.setBarisIn(baru); else K.setTargetH((baru * u.h) / 1000);
  };
  const reset = () => {
    K.setMode('ukuran'); K.setTargetW(4); K.setTargetH(2.25); K.setBulat('round'); K.setRuang(RUANG_AWAL);
  };
  const ubahO = (x: Partial<OpsiGambar>) => setO(v => ({ ...v, ...x }));
  const kontenBerikut: KontenPanggung = o.konten === 'contoh' ? 'grid' : 'contoh';

  return (
    <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="flex items-start gap-1">
          <TombolAlat label="Reset" onKlik={reset}><RotateCcw size={16} /></TombolAlat>
          <TombolAlat label="Penggaris" aktif={o.penggaris} onKlik={() => ubahO({ penggaris: !o.penggaris })}><Ruler size={16} /></TombolAlat>
          <TombolAlat label="Satuan" onKlik={() => ubahO({ satuan: o.satuan === 'm' ? 'ft' : 'm' })}>
            <span className="text-[10px] font-extrabold">{o.satuan === 'm' ? 'M' : 'FT'}</span>
          </TombolAlat>
          <TombolAlat label={o.konten === 'contoh' ? 'Konten' : 'Grid'} aktif={o.konten === 'grid'} onKlik={() => ubahO({ konten: kontenBerikut })}><IkonGambar size={16} /></TombolAlat>
          <TombolAlat label="Orang" aktif={o.orang} onKlik={() => ubahO({ orang: !o.orang })}><PersonStanding size={17} /></TombolAlat>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{multi ? `${p.kotak.length} screen · 1 video processor` : 'Susunan'}</p>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-tight">{kolom} × {baris}</p>
          <p className="text-[12px] text-slate-600">{h.jumlahCab} {namaUnit} · {u.w}×{u.h} mm</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="relative min-w-[640px] mx-auto" style={{ aspectRatio: `${VB_W} / ${Math.round(p.vbH)}` }}>
          <GambarPanggung p={p} o={o} id={id} diagonal={`${f(h.diagonalInci, 0)} inci`} multi={multi} />
          {o.penggaris && (
            <>
              <Langkah judul="kolom (lebar layar)" x={k.x + k.w / 2} y={p.garisAtas} vbH={p.vbH} nilai={teksUkur(h.lebarM, o.satuan)} sub={`${kolom} kolom`}
                onKurang={() => ubahKolom(-1)} onTambah={() => ubahKolom(1)} />
              <Langkah judul="baris (tinggi layar)" x={p.kananDinding + 46} y={k.y + k.h / 2} vbH={p.vbH} nilai={teksUkur(h.tinggiM, o.satuan)} sub={`${baris} baris`}
                onKurang={() => ubahBaris(-1)} onTambah={() => ubahBaris(1)} />
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/60">
        <Statistik label="Resolusi" nilai={`${h.resX} × ${h.resY}`} ket={`${f(h.totalPx / 1e6, 2)} MP`} />
        <Statistik label="Rasio" nilai={h.rasioTerdekat} ket={`tepat ${h.rasio}`} />
        <Statistik label="Ukuran layar" nilai={`${teksUkur(h.lebarM, o.satuan)} × ${teksUkur(h.tinggiM, o.satuan)}`} ket={`${f(h.luasM2)} m² · ${f(h.diagonalInci, 0)} inci`} />
        <Statistik label="Jarak pandang" nilai={`±${teksUkur(h.jarakIdealM, o.satuan)}`} ket={`minimum ${teksUkur(h.jarakMinM, o.satuan)}`} />
      </div>
    </section>
  );
}
