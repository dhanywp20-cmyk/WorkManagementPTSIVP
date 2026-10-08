'use client';
import { namaBerkas, unduhSvgPNG, unduhUrl } from '../../bersama/cetak';
import { Angka, Catatan, f, Nilai, Pilih, Segmen } from '../../bersama/ui';
import { warnaPort } from '../koneksi/data';
import { type DataDaya, MCB_SIRKUIT, type PengaturanDaya, susunDaya, WARNA_FASE } from './data';
import { svgDaya, svgPosterDaya } from './svg';
import { Download, Image as IkonGambar } from 'lucide-react';
import { useMemo, useState } from 'react';
/**
 * Power Connection LED: unit (modul/cabinet) disambung berurutan per sirkuit listrik,
 * tiap sirkuit dibatasi MCB-nya (beban kontinu 80%), lalu dibagi ke fase R/S/T supaya seimbang.
 * Diagram & tabelnya ikut cetak, PNG, dan SVG seperti Screen Connection.
 */

const kelasTombol = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40';

/** Ruang kerja Power Connection (sub menu LED Videotron). */
export function RuangDaya({ d, s, onUbah, namaFile }: { d: DataDaya; s: PengaturanDaya; onUbah: (s: PengaturanDaya) => void; namaFile: string }) {
  const h = useMemo(() => susunDaya(d, s), [d, s]);
  const svg = useMemo(() => svgDaya(d, h, s.arah), [d, h, s.arah]);
  const ubah = (p: Partial<PengaturanDaya>) => onUbah({ ...s, ...p });
  const totalA = h.totalW / (Math.max(1, d.tegangan) * Math.max(0.5, d.faktorDaya));
  const faseMaks = h.perFase.reduce((a, p) => Math.max(a, p.arus), 0);
  const faseMin = h.perFase.reduce((a, p) => Math.min(a, p.arus), Infinity);
  const poster = () => svgPosterDaya(d, s, 'Power Connection LED', namaFile);
  const [png, setPng] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const unduhPNG = async () => {
    setPng('proses');
    try { await unduhSvgPNG(poster(), namaBerkas('Power Connection', namaFile), 2); setPng('siap'); }
    catch { setPng('gagal'); setTimeout(() => setPng('siap'), 2500); }
  };
  const unduhSVG = () => {
    const url = URL.createObjectURL(new Blob([poster()], { type: 'image/svg+xml' }));
    unduhUrl(url, `${namaBerkas('Power Connection', namaFile)}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-start">
      <div className="space-y-3 min-w-0">
        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Segmen label="Sumber listrik" nilai={String(s.fase) as '1' | '3'} onUbah={v => ubah({ fase: v === '3' ? 3 : 1 })}
            opsi={[{ v: '1', l: '1 fase' }, { v: '3', l: '3 fase (R/S/T)' }]} />
          {s.fase === 1 && totalA > 32 && (
            <p className="-mt-1 text-[11.5px] text-amber-800">Arus total {f(totalA, 1)} A: umumnya disarankan 3 fase supaya beban terbagi.</p>
          )}
          <Pilih label="MCB tiap sirkuit" nilai={s.mcb} onUbah={v => ubah({ mcb: v })} opsi={MCB_SIRKUIT.map(v => ({ v, l: `${v} A` }))} />
          <Angka label="Beban maks per sirkuit" nilai={s.beban} satuan="%" step={1} onUbah={v => v >= 10 && v <= 100 && ubah({ beban: Math.round(v) })}
            bantuan={`80% = aturan beban kontinu · maks ${f(h.kapasitasW, 0)} W = ${h.unitPerSirkuitMaks} ${d.satuan}`} />
          <Segmen label="Arah kabel power" nilai={s.arah} onUbah={v => ubah({ arah: v })} opsi={[{ v: 'vertikal', l: 'Tegak per kolom' }, { v: 'horizontal', l: 'Mendatar per baris' }]} />
          <div className="grid grid-cols-2 gap-3">
            <Pilih label="Mulai dari" nilai={s.mulai} onUbah={v => ubah({ mulai: v })}
              opsi={[{ v: 'kiri-bawah', l: 'Kiri bawah' }, { v: 'kanan-bawah', l: 'Kanan bawah' }, { v: 'kiri-atas', l: 'Kiri atas' }, { v: 'kanan-atas', l: 'Kanan atas' }]} />
            <Pilih label="Pola" nilai={s.pola} onUbah={v => ubah({ pola: v })} opsi={[{ v: 'S', l: 'S · bolak-balik' }, { v: 'Z', l: 'Z · balik ke awal' }]} />
          </div>
          <Angka label="Panjang kabel panel → layar" nilai={s.panjang} satuan="m" onUbah={v => v >= 1 && ubah({ panjang: v })} bantuan="Untuk daftar material (BOM)" />
        </section>
      </div>
      <div className="space-y-3 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Nilai label="Sirkuit" nilai={h.sirkuit.length} ket={`MCB ${s.mcb} A · ${h.unitPerSirkuitMaks} ${d.satuan} maks`} />
          <Nilai label="Daya maks" nilai={f(h.totalW / 1000)} satuan="kW" ket={`${f(d.wattUnit, 0)} W/${d.satuan}`} />
          <Nilai label="Arus total" nilai={f(totalA, 1)} satuan="A" ket={`@${d.tegangan} V · PF ${f(d.faktorDaya)}`} />
          <Nilai label={s.fase === 3 ? 'Selisih fase' : 'MCB utama'} nilai={s.fase === 3 ? f(faseMaks - faseMin, 1) : `${h.perFase[0]?.mcb ?? '-'}`} satuan="A"
            ket={s.fase === 3 ? h.perFase.map(p => `${p.fase} ${f(p.arus, 0)} A`).join(' · ') : 'arus × 1,25'} nada={s.fase === 3 && faseMaks - faseMin > faseMaks * 0.2 ? 'awas' : undefined} />
        </div>
        {h.galat && <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{h.galat}</p>}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
            <span className="text-[12px] text-slate-600">C = sirkuit (warna), huruf = fase. Titik bulat = unit pertama yang menerima kabel dari panel.</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => void unduhPNG()} disabled={png === 'proses'} className={kelasTombol} title="Unduh diagram + legenda sebagai PNG">
                <IkonGambar size={14} /> {png === 'proses' ? '...' : png === 'gagal' ? 'Gagal' : 'PNG'}
              </button>
              <button type="button" onClick={unduhSVG} className={kelasTombol} title="Unduh diagram sebagai SVG"><Download size={14} /> SVG</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="p-2 [&>svg]:mx-auto [&>svg]:block" role="img" style={{ minWidth: Math.min(1100, d.kolom * 30 + 140) }}
              aria-label={`Diagram ${h.sirkuit.length} sirkuit power`} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-600"><tr>
                <th className="text-left font-bold px-3 py-2">Fase</th><th className="text-right font-bold px-3 py-2">Sirkuit</th>
                <th className="text-right font-bold px-3 py-2">Arus</th><th className="text-right font-bold px-3 py-2">MCB utama</th>
              </tr></thead>
              <tbody>{h.perFase.map(p => (
                <tr key={p.fase} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-semibold"><span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: WARNA_FASE[p.fase] }} />{p.fase}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.sirkuit}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{f(p.arus, 1)} A</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{p.mcb} A</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-600 sticky top-0"><tr>
                <th className="text-left font-bold px-3 py-2">Sirkuit</th><th className="text-right font-bold px-3 py-2">{d.satuan}</th>
                <th className="text-right font-bold px-3 py-2">Daya</th><th className="text-right font-bold px-3 py-2">Arus</th>
              </tr></thead>
              <tbody>{h.sirkuit.map(c => (
                <tr key={c.no} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-semibold whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: warnaPort(c.no) }} />C{c.no} · {c.fase}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.unit}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{f(c.watt, 0)} W</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{f(c.arus, 1)} A</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <Catatan>Daya per unit dari Calculator LED (putih penuh). Beban sirkuit dibatasi {s.beban}% rating MCB; MCB utama per fase ≥ 1,25 × arus. Rencana ini perkiraan engineering - kabel, grounding, dan panel tetap diverifikasi instalatir listrik bersertifikat.</Catatan>
      </div>
    </div>
  );
}
