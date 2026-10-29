'use client';
/**
 * Edge blending untuk proyeksi immersive: kolom × baris proyektor identik dengan overlap kiri-kanan &
 * atas-bawah sendiri. Ukuran dari lebar gambar satu proyektor ATAU dari ukuran layar target (lebar ×
 * tinggi) -> resolusi kanvas & konten, piksel ter-mask, kepadatan piksel, zona blending, peta piksel
 * per proyektor (setting media server) dan saran susunan. Rumus: lib/av-layar-proyektor.ts (rencanaBlending).
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, Segmen, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { type RencanaBlending, rencanaBlending, saranSusunanBlending, teksRasio } from '@/lib/av-layar-proyektor';
import { useState } from 'react';

const RESOLUSI = [
  { v: 'wuxga', l: 'WUXGA 1920 × 1200', x: 1920, y: 1200 },
  { v: 'fhd', l: 'Full HD 1920 × 1080', x: 1920, y: 1080 },
  { v: 'wqxga', l: 'WQXGA 2560 × 1600', x: 2560, y: 1600 },
  { v: '4k', l: '4K UHD 3840 × 2160', x: 3840, y: 2160 },
  { v: '4kdci', l: '4K DCI 4096 × 2160', x: 4096, y: 2160 },
  { v: 'sxga', l: 'SXGA+ 1400 × 1050', x: 1400, y: 1050 },
  { v: 'wxga', l: 'WXGA 1280 × 800', x: 1280, y: 800 },
  { v: 'xga', l: 'XGA 1024 × 768', x: 1024, y: 768 },
  { v: 'custom', l: 'Custom…', x: 0, y: 0 },
];
const CATATAN = 'Overlap umum 15-25% lebar gambar satu proyektor (atas-bawah biasanya sama); bisa diisi dalam % atau cm (lebar area blending di layar). Overlap dibulatkan ke piksel utuh seperti di media server. Mode Ukuran target: gambar per proyektor dibesarkan sampai susunan menutup lebar DAN tinggi target; kelebihan di satu arah di-mask (piksel ter-mask). Kanvas = resolusi output media server; konten = resolusi file konten yang perlu dibuat. Gunakan proyektor dengan model, lensa & umur sumber cahaya yang sama.';

const bulat = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const px = (x: number, y: number) => `${x} × ${y}`;

export function PanelBlending({ lebarSatuAwal }: { lebarSatuAwal: number }) {
  const [mode, setMode] = useState<'proyektor' | 'target'>('proyektor');
  const [kolom, setKolom] = useState(2);
  const [baris, setBaris] = useState(1);
  const [lebarSatu, setLebarSatu] = useState(() => bulat(lebarSatuAwal, 3));
  const [target, setTarget] = useState({ l: 8, t: 2.5 });
  const [overlapH, setOverlapH] = useState(15);
  const [overlapV, setOverlapV] = useState(15);
  /** Overlap diisi sebagai % gambar satu proyektor atau cm area blending di layar. */
  const [satuanOverlap, setSatuanOverlap] = useState<'persen' | 'cm'>('persen');
  const [resK, setResK] = useState('wuxga');
  const [custom, setCustom] = useState({ x: 1920, y: 1200 });
  const [throwRatio, setThrowRatio] = useState(0);
  const preset = RESOLUSI.find(x => x.v === resK)!;
  const res = resK === 'custom' ? custom : preset;
  const namaRes = resK === 'custom' ? `Custom ${px(custom.x, custom.y)}` : preset.l;
  const dalamCm = satuanOverlap === 'cm';
  const dasar = {
    resX: res.x, resY: res.y, throwRatio, targetLebarM: target.l, targetTinggiM: target.t,
    ...(dalamCm ? { overlapH: overlapH / 100, overlapV: overlapV / 100, overlapSatuan: 'meter' as const } : { overlapH, overlapV }),
  };
  const b = rencanaBlending({ ...dasar, kolom, baris, mode, lebarSatuM: lebarSatu });
  const modeTarget = mode === 'target';
  const saran = modeTarget ? saranSusunanBlending(dasar) : [];

  //  Pindah mode membawa ukuran yang sedang tampil, supaya angka tidak melompat.
  const gantiMode = (m: 'proyektor' | 'target') => {
    if (m === mode) return;
    if (m === 'target') setTarget({ l: bulat(b.lebarM), t: bulat(b.tinggiM) });
    else setLebarSatu(bulat(b.lebarSatuM, 3));
    setMode(m);
  };

  //  Ganti satuan overlap: isian ikut dikonversi dari ukuran gambar per proyektor saat ini.
  const gantiSatuanOverlap = (s: 'persen' | 'cm') => {
    if (s === satuanOverlap) return;
    if (s === 'cm') { setOverlapH(bulat((overlapH / 100) * b.lebarSatuM * 100, 1)); setOverlapV(bulat((overlapV / 100) * b.tinggiSatuM * 100, 1)); }
    else {
      setOverlapH(Math.min(50, bulat(b.lebarSatuM > 0 ? overlapH / b.lebarSatuM : 0, 1)));
      setOverlapV(Math.min(50, bulat(b.tinggiSatuM > 0 ? overlapV / b.tinggiSatuM : 0, 1)));
    }
    setSatuanOverlap(s);
  };
  const teksOverlapIsi = (v: number) => (dalamCm ? `${f(v, 1)} cm` : `${f(v, 1)}%`);

  const teksUkuran = modeTarget ? `target ${f(target.l)} × ${f(target.t)} m` : `${f(lebarSatu)} m per proyektor`;
  const ringkas = () => [
    `*Edge blending ${b.kolom} × ${b.baris} (${b.jumlah} proyektor ${namaRes}), ${teksUkuran}*`,
    `Overlap kiri-kanan ${f(b.overlapHM * 100, 1)} cm (${f(b.overlapHPersen, 1)}%, ${b.overlapHpx} px), atas-bawah ${f(b.overlapVM * 100, 1)} cm (${f(b.overlapVPersen, 1)}%, ${b.overlapVpx} px)`,
    `Gambar per proyektor ${f(b.lebarSatuM)} × ${f(b.tinggiSatuM)} m, gabungan ${f(b.lebarM)} × ${f(b.tinggiM)} m`,
    `Resolusi kanvas ${px(b.kanvasX, b.kanvasY)}${modeTarget ? `, konten ${px(b.kontenX, b.kontenY)} (mask ${b.maskX} × ${b.maskY} px)` : ''}`,
    `Kepadatan ${f(b.pxPerM, 0)} px/m (pitch ${f(b.pitchMm, 2)} mm), efisiensi piksel ${f(b.efisiensiPersen, 1)}%`,
    ...(b.jarakLemparM ? [`Jarak lempar ±${f(b.jarakLemparM)} m (TR ${throwRatio})`] : []),
  ].join('\n');
  const lembar = () => lembarAV('Edge Blending Proyektor',
    [['Susunan', `${b.kolom} × ${b.baris} (${b.jumlah} proyektor)`], ['Resolusi per proyektor', namaRes],
      ['Ukuran dari', modeTarget ? `Ukuran target ${f(target.l)} × ${f(target.t)} m` : `Lebar gambar / proyektor ${f(lebarSatu)} m`],
      ['Overlap kiri-kanan', `${teksOverlapIsi(overlapH)} → ${f(b.overlapHPersen, 1)}% · ${b.overlapHpx} px`],
      ['Overlap atas-bawah', `${teksOverlapIsi(overlapV)} → ${f(b.overlapVPersen, 1)}% · ${b.overlapVpx} px`],
      ...(throwRatio ? [['Throw ratio', String(throwRatio)] as [string, string]] : [])],
    [['Gambar per proyektor', `${f(b.lebarSatuM)} × ${f(b.tinggiSatuM)} m`], ['Gambar gabungan', `${f(b.lebarM)} × ${f(b.tinggiM)} m`, true],
      ['Resolusi kanvas', `${px(b.kanvasX, b.kanvasY)} (${teksRasio(b.kanvasX, b.kanvasY)})`, true],
      ...(modeTarget ? [['Resolusi konten', `${px(b.kontenX, b.kontenY)} (${teksRasio(b.kontenX, b.kontenY)})`, true] as [string, string, boolean],
        ['Piksel ter-mask', `${b.maskX} × ${b.maskY} px`] as [string, string]] : []),
      ['Area blending', `${f(b.overlapHM * 100, 1)} cm kiri-kanan · ${f(b.overlapVM * 100, 1)} cm atas-bawah`],
      ['Zona blending', `${b.zonaKiriKanan} kiri-kanan · ${b.zonaAtasBawah} atas-bawah · ${b.zonaSudut} sudut`],
      ['Kepadatan piksel', `${f(b.pxPerM, 0)} px/m · pitch ${f(b.pitchMm, 2)} mm`], ['Efisiensi piksel', `${f(b.efisiensiPersen, 1)}%`],
      ...(b.jarakLemparM ? [['Jarak lempar', `±${f(b.jarakLemparM)} m`] as [string, string]] : [])],
    CATATAN,
    [
      { judul: 'Peta piksel per proyektor (kanvas)', jenis: 'tabel', kepala: ['Proyektor', 'Kolom', 'Baris', 'X', 'Y', 'X akhir', 'Y akhir'], rataKanan: [1, 2, 3, 4, 5, 6],
        isi: b.peta.map(p => [p.nama, String(p.kolom), String(p.baris), String(p.x), String(p.y), String(p.x2), String(p.y2)]) },
      ...(saran.length ? [{ judul: 'Pilihan susunan untuk ukuran target', jenis: 'tabel' as const, kepala: ['Susunan', 'Proyektor', 'Resolusi konten', 'Gambar / proyektor', 'Pitch', 'Efisiensi'], rataKanan: [1, 4, 5],
        isi: saran.map(s => [`${s.kolom} × ${s.baris}`, String(s.jumlah), px(s.kontenX, s.kontenY), `${f(s.lebarSatuM)} × ${f(s.tinggiSatuM)} m`, `${f(s.pitchMm, 2)} mm`, `${f(s.efisiensiPersen, 0)}%`]) }] : []),
    ]);

  return (
    <Kartu judul="Edge blending · immersive" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Edge Blending')} />}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        {/* Masukan */}
        <div className="space-y-4 min-w-0">
          <Segmen label="Ukuran dari" nilai={mode} onUbah={gantiMode} opsi={[{ v: 'proyektor', l: 'Per proyektor' }, { v: 'target', l: 'Ukuran target' }]} />
          <div className="grid grid-cols-2 gap-3">
            {modeTarget ? (
              <>
                <Angka label="Lebar target" nilai={target.l} onUbah={v => v > 0 && setTarget(t => ({ ...t, l: v }))} satuan="m" bantuan="Lebar total layar / dinding yang harus tertutup gambar" />
                <Angka label="Tinggi target" nilai={target.t} onUbah={v => v > 0 && setTarget(t => ({ ...t, t: v }))} satuan="m" bantuan="Tinggi total layar / dinding yang harus tertutup gambar" />
              </>
            ) : (
              <>
                <Angka label="Lebar / proyektor" nilai={lebarSatu} onUbah={v => v > 0 && setLebarSatu(v)} satuan="m" bantuan="Lebar gambar SATU proyektor" />
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Tinggi / proyektor</span>
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-700">{f(b.tinggiSatuM)} <span className="text-xs font-semibold text-slate-500">m</span></p>
                </div>
              </>
            )}
            <Angka label="Kolom" nilai={kolom} onUbah={v => v >= 1 && v <= 12 && setKolom(Math.round(v))} step={1} />
            <Angka label="Baris" nilai={baris} onUbah={v => v >= 1 && v <= 6 && setBaris(Math.round(v))} step={1} />
            <div className="col-span-2">
              <Segmen label="Overlap dalam" nilai={satuanOverlap} onUbah={gantiSatuanOverlap} opsi={[{ v: 'persen', l: '% gambar' }, { v: 'cm', l: 'cm di layar' }]} />
            </div>
            {dalamCm ? (
              <>
                <Angka label="Overlap H" nilai={overlapH} onUbah={v => v >= 0 && setOverlapH(v)} satuan="cm" bantuan="Lebar area blending kiri-kanan di layar (cm). Maksimal 50% lebar gambar satu proyektor." />
                <Angka label="Overlap V" nilai={overlapV} onUbah={v => v >= 0 && setOverlapV(v)} satuan="cm" bantuan="Tinggi area blending atas-bawah di layar (cm). Maksimal 50% tinggi gambar satu proyektor." />
              </>
            ) : (
              <>
                <Angka label="Overlap H" nilai={overlapH} onUbah={v => v >= 0 && v <= 50 && setOverlapH(v)} satuan="%" bantuan="Overlap kiri-kanan, % lebar gambar satu proyektor" />
                <Angka label="Overlap V" nilai={overlapV} onUbah={v => v >= 0 && v <= 50 && setOverlapV(v)} satuan="%" bantuan="Overlap atas-bawah, % tinggi gambar satu proyektor" />
              </>
            )}
            <div className="col-span-2"><Pilih label="Resolusi proyektor" nilai={resK} onUbah={setResK} opsi={RESOLUSI.map(x => ({ v: x.v, l: x.l }))} /></div>
            {resK === 'custom' && (
              <>
                <Angka label="Res. horizontal" nilai={custom.x} onUbah={v => v >= 320 && v <= 8192 && setCustom(c => ({ ...c, x: Math.round(v) }))} satuan="px" step={1} />
                <Angka label="Res. vertikal" nilai={custom.y} onUbah={v => v >= 200 && v <= 8192 && setCustom(c => ({ ...c, y: Math.round(v) }))} satuan="px" step={1} />
              </>
            )}
            <Angka label="Throw ratio" nilai={throwRatio} onUbah={v => v >= 0 && v <= 10 && setThrowRatio(v)} bantuan="Opsional - isi untuk menghitung jarak lempar (TR × lebar gambar per proyektor). 0 = tidak dihitung." />
          </div>
        </div>

        {/* Hasil */}
        <div className="space-y-4 min-w-0">
          <DiagramBlending b={b} modeTarget={modeTarget} />
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            <Nilai label="Proyektor" nilai={b.jumlah} ket={`${b.kolom} kolom × ${b.baris} baris`} />
            <Nilai label="Resolusi kanvas" nilai={px(b.kanvasX, b.kanvasY)} ket={`${teksRasio(b.kanvasX, b.kanvasY)} · output media server`} />
            {modeTarget && (
              <Nilai label="Resolusi konten" nilai={px(b.kontenX, b.kontenY)} nada="baik"
                ket={b.maskX || b.maskY ? `${teksRasio(b.kontenX, b.kontenY)} · mask ${b.maskX} × ${b.maskY} px` : `${teksRasio(b.kontenX, b.kontenY)} · tanpa mask`} />
            )}
            <Nilai label="Gambar gabungan" nilai={`${f(b.lebarM)} × ${f(b.tinggiM)}`} satuan="m" ket={`${f(b.lebarM * b.tinggiM)} m²`} />
            <Nilai label="Gambar / proyektor" nilai={`${f(b.lebarSatuM)} × ${f(b.tinggiSatuM)}`} satuan="m"
              ket={`±${f(Math.hypot(b.lebarSatuM, b.tinggiSatuM) / 0.0254, 0)} inci`} />
            <Nilai label="Overlap kiri-kanan" nilai={f(b.overlapHM * 100, 1)} satuan="cm"
              ket={b.kolom > 1 ? `${f(b.overlapHPersen, 1)}% · ${b.overlapHpx} px · ${b.zonaKiriKanan} zona` : 'tidak ada (1 kolom)'} />
            <Nilai label="Overlap atas-bawah" nilai={f(b.overlapVM * 100, 1)} satuan="cm"
              ket={b.baris > 1 ? `${f(b.overlapVPersen, 1)}% · ${b.overlapVpx} px · ${b.zonaAtasBawah} zona` : 'tidak ada (1 baris)'} />
            <Nilai label="Kepadatan piksel" nilai={f(b.pxPerM, 0)} satuan="px/m" ket={`pitch ${f(b.pitchMm, 2)} mm`} />
            <Nilai label="Efisiensi piksel" nilai={f(b.efisiensiPersen, 1)} satuan="%" nada={b.efisiensiPersen >= 80 ? 'baik' : b.efisiensiPersen >= 65 ? 'awas' : 'buruk'}
              ket="terpakai konten" />
            {b.jarakLemparM > 0 && <Nilai label="Jarak lempar" nilai={`±${f(b.jarakLemparM)}`} satuan="m" ket={`TR ${throwRatio}`} />}
          </div>

          {modeTarget && saran.length > 0 && (
            <div className="min-w-0">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Pilihan susunan untuk {f(target.l)} × {f(target.t)} m</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-[12.5px] tabular-nums">
                  <thead className="bg-slate-50 text-slate-600 text-left">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Susunan</th>
                      <th className="px-3 py-2 font-semibold">Resolusi konten</th>
                      <th className="px-3 py-2 font-semibold hidden sm:table-cell">Gambar / proyektor</th>
                      <th className="px-3 py-2 font-semibold text-right hidden sm:table-cell">Pitch</th>
                      <th className="px-3 py-2 font-semibold text-right">Efisiensi</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {saran.map(s => {
                      const aktif = s.kolom === b.kolom && s.baris === b.baris;
                      return (
                        <tr key={`${s.kolom}x${s.baris}`} className={`border-t border-slate-100 ${aktif ? 'bg-blue-50/60' : ''}`}>
                          <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{s.kolom} × {s.baris} <span className="font-normal text-slate-500">({s.jumlah})</span></td>
                          <td className="px-3 py-2 whitespace-nowrap">{px(s.kontenX, s.kontenY)}</td>
                          <td className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">{f(s.lebarSatuM)} × {f(s.tinggiSatuM)} m</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap hidden sm:table-cell">{f(s.pitchMm, 2)} mm</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{f(s.efisiensiPersen, 0)}%</td>
                          <td className="px-3 py-2 text-right">
                            {aktif ? <span className="text-[11.5px] font-semibold text-blue-700">Dipakai</span> : (
                              <button type="button" onClick={() => { setKolom(s.kolom); setBaris(s.baris); }}
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-100">Pakai</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-700">Peta piksel per proyektor (setting media server)</summary>
            <div className="mt-2 max-h-72 overflow-auto">
              <table className="w-full text-[12.5px] tabular-nums">
                <thead className="text-slate-600 text-left sticky top-0 bg-slate-50">
                  <tr><th className="py-1.5 pr-3 font-semibold">Proyektor</th><th className="py-1.5 pr-3 font-semibold">Posisi</th><th className="py-1.5 pr-3 font-semibold text-right">X</th><th className="py-1.5 pr-3 font-semibold text-right">Y</th><th className="py-1.5 font-semibold text-right">Area</th></tr>
                </thead>
                <tbody>
                  {b.peta.map(p => (
                    <tr key={p.nama} className="border-t border-slate-200/70">
                      <td className="py-1.5 pr-3 font-semibold text-slate-800">{p.nama}</td>
                      <td className="py-1.5 pr-3 text-slate-600 whitespace-nowrap">kolom {p.kolom}, baris {p.baris}</td>
                      <td className="py-1.5 pr-3 text-right">{p.x}</td>
                      <td className="py-1.5 pr-3 text-right">{p.y}</td>
                      <td className="py-1.5 text-right whitespace-nowrap text-slate-600">{p.x}–{p.x2} · {p.y}–{p.y2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
      <Catatan>{CATATAN}</Catatan>
    </Kartu>
  );
}

/** Gambar susunan proporsional: tiap proyektor kotak tembus pandang (overlap jadi lebih gelap), area konten bergaris putus. */
function DiagramBlending({ b, modeTarget }: { b: RencanaBlending; modeTarget: boolean }) {
  const huruf = Math.max(b.kanvasY * 0.07, b.kanvasX * 0.022);
  const kx = (b.kanvasX - b.kontenX) / 2, ky = (b.kanvasY - b.kontenY) / 2;
  return (
    <figure className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex justify-center">
        <svg viewBox={`${-huruf * 0.3} ${-huruf * 0.3} ${b.kanvasX + huruf * 0.6} ${b.kanvasY + huruf * 0.6}`} role="img"
          aria-label={`Susunan ${b.kolom} × ${b.baris} proyektor, kanvas ${b.kanvasX} × ${b.kanvasY} px`}
          className="w-full max-h-56" preserveAspectRatio="xMidYMid meet">
          <rect x={0} y={0} width={b.kanvasX} height={b.kanvasY} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {b.peta.map(p => (
            <g key={p.nama}>
              <rect x={p.x} y={p.y} width={b.resX} height={b.resY} fill="#3b82f6" fillOpacity={0.16} stroke="#2563eb" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              <text x={p.x + b.resX / 2} y={p.y + b.resY / 2} textAnchor="middle" dominantBaseline="central" fontSize={huruf} fontWeight={700} fill="#1e3a8a">{p.nama}</text>
            </g>
          ))}
          {modeTarget && (
            <rect x={kx} y={ky} width={b.kontenX} height={b.kontenY} fill="none" stroke="#059669" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-600" />gambar proyektor</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/40 border border-blue-600" />area blending</span>
        {modeTarget && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-dashed border-emerald-600" />area konten (target)</span>}
        <span className="ml-auto tabular-nums">{b.kanvasX} × {b.kanvasY} px · {f(b.lebarM)} × {f(b.tinggiM)} m</span>
      </figcaption>
    </figure>
  );
}
