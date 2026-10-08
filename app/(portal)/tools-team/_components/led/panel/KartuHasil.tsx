'use client';
/** Kartu hasil: susunan & pratinjau grid, ukuran, resolusi, jarak pandang, daya, panas, berat. */
import { f, Kartu, Nilai, TombolSalin } from '../../bersama/ui';
import type { AlatLED } from './alat';

export function KartuHasil({ a }: { a: AlatLED }) {
  const { baris, customer, h, kolom, lewat4K, mode, n, namaUnit, pembuat, project, selisihH, selisihW, tanggal, tegangan } = a.K;
  const { cetak, pngLED, ringkasan } = a.E;
  const skala = Math.min(320 / h.lebarM, 220 / h.tinggiM);
  const wPx = h.lebarM * skala, hPx = h.tinggiM * skala;
  const garisTipis = (k: number) => (k > 60 ? 0 : k > 30 ? 0.3 : 0.8);

  return (
    <>
      <Kartu judul={n > 1 ? 'Hasil per screen' : 'Hasil'} aksi={<TombolSalin teks={ringkasan} onCetak={cetak} onPng={pngLED} />}>
        {(project || customer) && (
          <p className="text-[12.5px] text-slate-600 mb-3">
            <span className="font-semibold text-slate-800">{project || '-'}</span>{customer && ` · ${customer}`}
            {(pembuat || tanggal) && <span className="block text-[11.5px] text-slate-500">{[pembuat, tanggal].filter(Boolean).join(' · ')}</span>}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
          <svg viewBox={`0 0 ${wPx + 20} ${hPx + 36}`} className="w-full max-w-[340px]" role="img"
            aria-label={`Susunan ${kolom} × ${baris} ${namaUnit}`}>
            <g transform="translate(10,10)">
              <rect width={wPx} height={hPx} fill="#0f172a" rx="2" />
              {garisTipis(kolom) > 0 && Array.from({ length: kolom + 1 }, (_, i) => (
                <line key={`v${i}`} x1={(i * wPx) / kolom} x2={(i * wPx) / kolom} y1={0} y2={hPx} stroke="#334155" strokeWidth={garisTipis(kolom)} />
              ))}
              {garisTipis(baris) > 0 && Array.from({ length: baris + 1 }, (_, i) => (
                <line key={`h${i}`} y1={(i * hPx) / baris} y2={(i * hPx) / baris} x1={0} x2={wPx} stroke="#334155" strokeWidth={garisTipis(baris)} />
              ))}
              <text x={wPx / 2} y={hPx + 18} textAnchor="middle" fontSize="11" fill="#475569">{f(h.lebarM)} m · {h.resX} px</text>
            </g>
          </svg>
          <div className="text-center sm:text-left">
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{kolom} × {baris}</p>
            <p className="text-sm text-slate-600">{h.jumlahCab} {namaUnit} · {f(h.lebarM)} × {f(h.tinggiM)} m</p>
            {mode === 'ukuran' && (Math.abs(selisihW) > 0.001 || Math.abs(selisihH) > 0.001) && (
              <p className="text-[12px] text-amber-700 mt-1">
                Selisih dari target: {selisihW >= 0 ? '+' : ''}{f(selisihW * 100, 1)} cm lebar, {selisihH >= 0 ? '+' : ''}{f(selisihH * 100, 1)} cm tinggi
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Nilai label="Resolusi" nilai={`${h.resX} × ${h.resY}`} ket={`${f(h.totalPx / 1e6, 2)} MP · per ${namaUnit} ${h.pxCabX}×${h.pxCabY}`} nada={lewat4K ? 'awas' : undefined} />
          <Nilai label="Rasio" nilai={h.rasioTerdekat} ket={`tepat ${h.rasio}`} />
          <Nilai label="Luas / diagonal" nilai={f(h.luasM2)} satuan="m²" ket={`${f(h.diagonalInci, 0)} inci`} />
          <Nilai label="Jarak pandang min" nilai={f(h.jarakMinM, 1)} satuan="m" ket={`ideal ±${f(h.jarakIdealM, 1)} m (estimasi)`} />
          <Nilai label="Daya maks" nilai={f(h.dayaMaksW / 1000)} satuan="kW" ket={`rata-rata ${f(h.dayaRataW / 1000)} kW`} />
          <Nilai label={`Arus maks @${tegangan}V`} nilai={f(h.arusMaksA, 1)} satuan="A"
            ket={`MCB ${h.mcbSaranA} A${h.arusMaksA > 32 ? ' · pertimbangkan 3 fase' : ''}`} nada={h.arusMaksA > 63 ? 'awas' : undefined} />
          <Nilai label="Panas (rata-rata)" nilai={f(h.panasBTU, 0)} satuan="BTU/h" ket={`±${f(h.panasBTU / 9000, 1)} PK AC`} />
          <Nilai label="Berat" nilai={f(h.beratKg, 0)} satuan="kg" ket="belum termasuk rangka" />
          <Nilai label="Port LAN" nilai={h.portLAN} ket={`±${f(h.pxPerPort / 1000, 0)} rb px/port`} />
        </div>
        {lewat4K && (
          <p className="mt-3 text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Resolusi melebihi 3840 × 2160: satu sumber/input 4K tidak cukup untuk native pixel. Pakai beberapa input, processor dengan scaling, atau splicer.
          </p>
        )}
        {n > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">Total {n} screen</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Nilai label={`Total ${namaUnit}`} nilai={h.jumlahCab * n} />
              <Nilai label="Total luas" nilai={f(h.luasM2 * n)} satuan="m²" />
              <Nilai label="Total daya maks" nilai={f((h.dayaMaksW * n) / 1000)} satuan="kW" />
              <Nilai label="Total berat" nilai={f(h.beratKg * n, 0)} satuan="kg" />
            </div>
          </div>
        )}
      </Kartu>
    </>
  );
}
