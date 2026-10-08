'use client';
import type React from 'react';
/** Kartu ringkasan layar di sub menu Screen / Power Connection. */
import { f, Kartu } from '../../bersama/ui';
import { ArrowRight } from 'lucide-react';
import { AksiFile } from './AksiFile';
import type { AlatLED } from './alat';

export function KartuLayar({ a, judul, children }: { a: AlatLED; judul: string; children?: React.ReactNode }) {
  const { baris, bit, customer, fileAktif, h, kolom, labelLED, namaUnit, pindah, project, px, refresh, u } = a.K;
  return (
    <>
      <Kartu judul={judul} aksi={<div className="flex items-center gap-2 flex-wrap"><AksiFile a={a} />{children}</div>}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[13px] text-slate-800">
              <span className="font-bold">{project || 'Tanpa nama project'}</span>{customer && <span className="text-slate-600"> · {customer}</span>}
              {fileAktif && <span className="text-slate-500"> · file {fileAktif.nama}</span>}
            </p>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Layar dari Calculator LED: <b className="text-slate-800">{labelLED}</b> · {kolom} × {baris} {namaUnit} ({u.w}×{u.h} mm, {px.x}×{px.y} px) · {f(h.lebarM)} × {f(h.tinggiM)} m · {h.resX} × {h.resY} px · {refresh} Hz {bit}-bit
            </p>
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
