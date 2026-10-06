'use client';
/** Bilah benda terpilih: geser / putar, tempel ke dinding. */
import { Segmen } from '../../ui';
import { BISA_TEMPEL } from '../inti';
import type { Sisi } from '../mesin/tipe';
import type { AlatDesain } from './alat';

export function BilahTerpilih({ a }: { a: AlatDesain }) {
  const { modeGizmo, setModeGizmo, terpilih } = a.K;
  const { tempel } = a.aksi;
  return (
    <>
      {/* Bilah benda terpilih */}
      {terpilih ? (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 flex-wrap bg-blue-50/50">
          <p className="text-[13px] font-bold text-slate-900 mr-1 truncate max-w-[200px]">{terpilih.nama}</p>
          <Segmen nilai={modeGizmo} onUbah={setModeGizmo} opsi={[{ v: 'translate', l: 'Geser' }, { v: 'rotate', l: 'Putar' }]} />
          {BISA_TEMPEL.includes(terpilih.jenis) && (
            <div className="flex items-center gap-1" role="group" aria-label="Tempel ke dinding">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Dinding</span>
              {(['depan', 'belakang', 'kiri', 'kanan'] as Sisi[]).map(s => (
                <button key={s} type="button" onClick={() => tempel(s)} className="px-2 py-1 rounded-md text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 capitalize">{s}</button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
