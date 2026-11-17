'use client';
import type React from 'react';
import { f, Kartu } from '../../bersama/ui';
import { ArrowRight } from 'lucide-react';
import { AksiFile } from './AksiFile';
import type { AlatLED } from './alat';

export function KartuLayar({ a, judul, children }: { a: AlatLED; judul: string; children?: React.ReactNode }) {
  const { baris, bit, berkas, customer, h, kolom, labelLED, layarTurunan, modulCampur, multi, namaLayar, namaUnit, pindah, project, px, refresh, u } = a.K;
  return (
    <>
      <Kartu judul={judul} aksi={<div className="flex items-center gap-2 flex-wrap"><AksiFile a={a} />{children}</div>}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[13px] text-slate-800">
              <span className="font-bold">{project || 'Tanpa nama project'}</span>{customer && <span className="text-slate-600"> · {customer}</span>}
              {berkas.aktif && <span className="text-slate-500"> · file {berkas.aktif.nama}</span>}
            </p>
            {multi ? (
              <p className="text-[12px] text-slate-600 mt-0.5">
                {layarTurunan.length + 1} screen dari Calculator LED{!modulCampur && <> · <b className="text-slate-800">{labelLED}</b> ({u.w}×{u.h} mm, {px.x}×{px.y} px)</>} · {refresh} Hz {bit}-bit:{' '}
                {[{ nama: namaLayar || 'Screen 1', lbl: labelLED, k: kolom, b: baris, hl: h }, ...layarTurunan.map(x => ({ nama: x.l.nama, lbl: x.labelLED, k: x.kolom, b: x.baris, hl: x.h }))]
                  .map(x => `${x.nama}${modulCampur ? ` ${x.lbl}` : ''} ${x.k}×${x.b} (${f(x.hl.lebarM)}×${f(x.hl.tinggiM)} m)`).join(' · ')}
              </p>
            ) : <p className="text-[12px] text-slate-600 mt-0.5">
              Layar dari Calculator LED: <b className="text-slate-800">{labelLED}</b> · {kolom} × {baris} {namaUnit} ({u.w}×{u.h} mm, {px.x}×{px.y} px) · {f(h.lebarM)} × {f(h.tinggiM)} m · {h.resX} × {h.resY} px · {refresh} Hz {bit}-bit
            </p>}
          </div>
          <button type="button" onClick={() => pindah('led')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
            Ubah layar di Calculator LED <ArrowRight size={14} />
          </button>
        </div>
      </Kartu>
    </>
  );
}
