'use client';
/** Panel daftar benda: pilih, sembunyikan label, hapus. */
import { f } from '../../bersama/ui';
import { ruangDari, togglePilih } from '../inti';
import { Copy } from 'lucide-react';
import type { AlatDesain } from './alat';

export function DaftarBenda({ a }: { a: AlatDesain }) {
  const { benda, duaRuang, kotakRuang, pilih, pilihLain, ruang, setPilih, setPilihan, sisi } = a.K;
  const { salinIsiRuang } = a.aksi;
  return (
    <>
      {sisi === 'daftar' && (
        <>
          {kotakRuang.map((k, i) => {
            const isi = benda.filter(b => ruangDari(ruang, b.x) === i);
            return (
              <div key={i} className="mb-3 last:mb-0">
                {duaRuang && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Ruang {i + 1} · {f(k.p)} × {f(k.l)} m</p>
                    {isi.length > 0 && (
                      <button type="button" onClick={() => salinIsiRuang(i, false)} className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-700 hover:underline">
                        <Copy size={13} /> Salin isi ke Ruang {(i + 1) % kotakRuang.length + 1}
                      </button>
                    )}
                  </div>
                )}
                {isi.length === 0 ? <p className="text-sm text-slate-600">Belum ada benda.</p> : (
                  <ul className="space-y-0.5">
                    {isi.map(b => (
                      <li key={b.id}>
                        <button type="button" title="Shift / Ctrl + klik = pilih banyak" onClick={e => {
                          if (!(e.shiftKey || e.ctrlKey || e.metaKey)) { setPilih(b.id); return; }
                          const r = togglePilih(pilih, pilihLain, b.id);
                          setPilihan(r.pilih, r.lain);
                        }}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-[13px] ${b.id === pilih ? 'bg-blue-50 text-blue-800 font-semibold' : pilihLain.includes(b.id) ? 'bg-blue-50/60 text-blue-700' : 'text-slate-800 hover:bg-slate-50'}`}>
                          {b.nama} <span className="text-slate-500">· {f(b.x, 1)}, {f(b.z, 1)} m{b.elev > 0.05 ? ` · ${f(b.elev)} m dari lantai` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
