'use client';
import { f } from '../../bersama/ui';
import { namaCadangan, namaPort, warnaPort } from './data';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function TabelPort({ a }: { a: AlatRuangKoneksi }) {
  const { g: t, m, off, pilihLayar, portAktif, s, setPortAktif } = a;
  const k = t.hasil;
  const klik = (port: number) => {
    const j = m.pemilik(port), b = m.per[j];
    pilihLayar(j);
    if (b.s.mode === 'manual') setPortAktif(port - b.off);
  };
  return (
    <>
      <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-50 text-slate-600 sticky top-0">
            <tr>
              {m.multi && <th className="text-left font-bold px-3 py-2">Screen</th>}
              <th className="text-left font-bold px-3 py-2">Port</th>
              <th className="text-right font-bold px-3 py-2">RC</th>
              <th className="text-right font-bold px-3 py-2">Pixel</th>
              <th className="text-left font-bold px-3 py-2 w-40">Beban</th>
              <th className="text-left font-bold px-3 py-2">Masuk di</th>
              {t.cadangan !== 'tidak' && <th className="text-left font-bold px-3 py-2">Cadangan (B)</th>}
            </tr>
          </thead>
          <tbody>
            {k.port.map(p => (
              <tr key={p.port} className={`border-t border-slate-100 ${m.multi || s.mode === 'manual' ? 'cursor-pointer hover:bg-slate-50' : ''} ${s.mode === 'manual' && p.port === off + portAktif ? 'bg-blue-50/60' : ''}`}
                onClick={() => (m.multi || s.mode === 'manual') && klik(p.port)}>
                {m.multi && <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{m.per[m.pemilik(p.port)].nama}</td>}
                <td className="px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                  <span className="inline-block w-2.5 h-2.5 rounded-xs mr-2 align-middle" style={{ background: warnaPort(p.port) }} />{namaPort(t, p.port)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.jumlah}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.px.toLocaleString('id-ID')}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full ${p.beban > 100 ? 'bg-rose-600' : p.beban > s.beban ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, p.beban)}%` }} />
                    </div>
                    <span className="tabular-nums w-9 text-right">{f(p.beban, 0)}%</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{p.mulai ? `kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : '—'}</td>
                {t.cadangan !== 'tidak' && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{p.jumlah ? namaCadangan(t, p.port) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
