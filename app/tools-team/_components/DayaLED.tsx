'use client';
import { useMemo, useState } from 'react';
import { Download, Image as IkonGambar } from 'lucide-react';
import { hitungDayaLED, type HasilDayaLED, type SudutMulai } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Nilai, Catatan, f } from './ui';
import { esc, namaBerkas, unduhSvgPNG, unduhUrl, type Seksi } from './cetak';
import { warnaPort } from './KoneksiLED';

/**
 * Power Connection LED: unit (modul/cabinet) disambung berurutan per sirkuit listrik,
 * tiap sirkuit dibatasi MCB-nya (beban kontinu 80%), lalu dibagi ke fase R/S/T supaya seimbang.
 * Diagram & tabelnya ikut cetak, PNG, dan SVG seperti Screen Connection.
 */

/** Pengaturan power connection (disimpan bersama hitungan LED, ikut undo/redo). */
export interface PengaturanDaya {
  fase: 1 | 3; mcb: number; beban: number;
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z';
  /** Panjang kabel tiap sirkuit dari panel ke layar (m). */ panjang: number;
}
export const DAYA_AWAL: PengaturanDaya = { fase: 1, mcb: 16, beban: 80, mulai: 'kiri-bawah', arah: 'vertikal', pola: 'S', panjang: 15 };
export const MCB_SIRKUIT = [10, 16, 20, 25, 32];

export function bersihkanDaya(x: unknown): PengaturanDaya {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const pilih = <T extends string | number>(v: unknown, sah: readonly T[], awal: T): T => (sah.includes(v as T) ? (v as T) : awal);
  const angka = (v: unknown, min: number, maks: number, awal: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, v)) : awal);
  const A = DAYA_AWAL;
  return {
    fase: pilih(o.fase, [1, 3] as const, A.fase),
    mcb: pilih(o.mcb, MCB_SIRKUIT, A.mcb),
    beban: Math.round(angka(o.beban, 10, 100, A.beban)),
    mulai: pilih(o.mulai, ['kiri-atas', 'kanan-atas', 'kiri-bawah', 'kanan-bawah'] as const, A.mulai),
    arah: pilih(o.arah, ['horizontal', 'vertikal'] as const, A.arah),
    pola: pilih(o.pola, ['S', 'Z'] as const, A.pola),
    panjang: angka(o.panjang, 1, 500, A.panjang),
  };
}

/** Data layar dari kalkulator. */
export interface DataDaya {
  kolom: number; baris: number; wUnit: number; hUnit: number; satuan: 'modul' | 'cabinet';
  /** W maks per unit. */ wattUnit: number; tegangan: number; faktorDaya: number;
}

export const susunDaya = (d: DataDaya, s: PengaturanDaya): HasilDayaLED => hitungDayaLED({
  kolom: d.kolom, baris: d.baris, wattUnit: d.wattUnit, tegangan: d.tegangan, faktorDaya: d.faktorDaya,
  mcb: s.mcb, beban: s.beban, fase: s.fase, mulai: s.mulai, arah: s.arah, pola: s.pola,
});

const WARNA_FASE: Record<string, string> = { L: '#334155', R: '#dc2626', S: '#ca8a04', T: '#2563eb' };

/** Diagram sirkuit power (SVG mandiri) untuk layar, cetak, dan unduhan. */
export function svgDaya(d: DataDaya, h: HasilDayaLED, arah: 'horizontal' | 'vertikal', judul?: string): string {
  const lebarM = (d.kolom * d.wUnit) / 1000, tinggiM = (d.baris * d.hUnit) / 1000;
  const skala = Math.min(860 / Math.max(0.01, lebarM), 430 / Math.max(0.01, tinggiM));
  const W = lebarM * skala, H = tinggiM * skala, cw = W / d.kolom, ch = H / d.baris;
  const ox = 52, oy = judul ? 52 : 30;
  const n = (v: number) => Math.round(v * 10) / 10;
  const pusat = (c: number, r: number) => [ox + (c + 0.5) * cw, oy + (r + 0.5) * ch];
  const selMin = Math.min(cw, ch);
  const banyak = d.kolom * d.baris > 2500;
  const out: string[] = [];
  const noSirkuit = new Map<string, number>();
  for (const s of h.hasil.sel) noSirkuit.set(`${s.c},${s.r}`, s.port);
  for (let r = 0; r < d.baris; r++) for (let c = 0; c < d.kolom; c++) {
    const no = noSirkuit.get(`${c},${r}`);
    out.push(`<rect x="${n(ox + c * cw)}" y="${n(oy + r * ch)}" width="${n(cw)}" height="${n(ch)}" fill="${no ? warnaPort(no) : '#fff'}" fill-opacity="0.17" stroke="#94a3b8" stroke-width="${banyak ? 0.2 : 0.6}"/>`);
  }
  out.push(`<rect x="${ox}" y="${oy}" width="${n(W)}" height="${n(H)}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`);
  if (!banyak) {
    const perSirkuit = new Map<number, number[][]>();
    for (const s of h.hasil.sel) { const a = perSirkuit.get(s.port) ?? []; a.push(pusat(s.c, s.r)); perSirkuit.set(s.port, a); }
    perSirkuit.forEach((titik, no) => {
      if (titik.length > 1) out.push(`<polyline points="${titik.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${warnaPort(no)}" stroke-width="${n(Math.max(1, Math.min(2.5, selMin * 0.06)))}" stroke-linejoin="round" stroke-opacity="0.85"/>`);
    });
  }
  //  Titik masuk tiap sirkuit: label sirkuit + fase di tepi terdekat.
  for (const s of h.sirkuit) {
    if (!s.mulai) continue;
    const m = s.mulai, [cx, cy] = pusat(m.c, m.r), warna = warnaPort(s.no);
    //  Seri jarak: sisi searah kabel didahulukan (kabel tegak masuk dari atas/bawah).
    const searah = (sisi: string) => ((sisi === 'atas' || sisi === 'bawah') === (arah === 'vertikal') ? 1 : 0);
    const jarak = [{ sisi: 'kiri', v: m.c }, { sisi: 'kanan', v: d.kolom - 1 - m.c }, { sisi: 'atas', v: m.r }, { sisi: 'bawah', v: d.baris - 1 - m.r }]
      .sort((a, b) => a.v - b.v || searah(b.sisi) - searah(a.sisi));
    const teks = `C${s.no} · ${s.fase}`, lw = 10 + teks.length * 6, lh = 15;
    out.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.max(2.5, Math.min(6, selMin * 0.16)))}" fill="${warna}" stroke="#fff" stroke-width="1.2"/>`);
    const sisi = jarak[0].v === 0 ? jarak[0].sisi : 'dalam';
    const [lx, ly] = sisi === 'kiri' ? [ox - lw - 6, cy - lh / 2] : sisi === 'kanan' ? [ox + W + 6, cy - lh / 2]
      : sisi === 'atas' ? [cx - lw / 2, oy - lh - 5] : sisi === 'bawah' ? [cx - lw / 2, oy + H + 5] : [cx - lw / 2, cy + 4];
    if (sisi !== 'dalam') {
      const [ex, ey] = sisi === 'kiri' ? [ox, cy] : sisi === 'kanan' ? [ox + W, cy] : sisi === 'atas' ? [cx, oy] : [cx, oy + H];
      out.push(`<line x1="${n(lx + (sisi === 'kiri' ? lw : sisi === 'kanan' ? 0 : lw / 2))}" y1="${n(ly + (sisi === 'atas' ? lh : sisi === 'bawah' ? 0 : lh / 2))}" x2="${n(ex)}" y2="${n(ey)}" stroke="${warna}" stroke-width="1.6"/>`);
    }
    out.push(`<rect x="${n(lx)}" y="${n(ly)}" width="${n(lw)}" height="${lh}" rx="4" fill="${warna}"/>`);
    out.push(`<rect x="${n(lx + lw - 5)}" y="${n(ly)}" width="5" height="${lh}" rx="2" fill="${WARNA_FASE[s.fase] ?? '#334155'}"/>`);
    out.push(`<text x="${n(lx + (lw - 4) / 2)}" y="${n(ly + 11)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${esc(teks)}</text>`);
  }
  const fm = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  out.push(`<text x="${n(ox + W / 2)}" y="${n(oy + H + 36)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial">${fm(lebarM)} m · ${d.kolom} ${d.satuan}</text>`);
  out.push(`<text x="${n(ox - 34)}" y="${n(oy + H / 2)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial" transform="rotate(-90 ${n(ox - 34)} ${n(oy + H / 2)})">${fm(tinggiM)} m · ${d.baris} baris</text>`);
  if (judul) out.push(`<text x="${ox}" y="20" font-size="13" font-weight="700" fill="#0f172a" font-family="Segoe UI,Arial">${esc(judul)}</text>`);
  const lebar = n(W + ox + 80), tinggi = n(H + oy + 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}" viewBox="0 0 ${lebar} ${tinggi}" style="max-width:100%;height:auto">${out.join('')}</svg>`;
}

const teksCara = (s: PengaturanDaya) => `${s.fase === 3 ? '3 fase' : '1 fase'}, MCB ${s.mcb} A/sirkuit, beban maks ${s.beban}%, kabel ${s.arah === 'vertikal' ? 'tegak per kolom' : 'mendatar per baris'} pola ${s.pola}`;

/** Ringkasan untuk Salin/WA. */
export function ringkasanDaya(d: DataDaya, s: PengaturanDaya): string {
  const h = susunDaya(d, s);
  return [
    `Power connection: ${h.sirkuit.length} sirkuit · ${teksCara(s)}`,
    `Total ${f(h.totalW / 1000)} kW maks @${d.tegangan} V · maks ${h.unitPerSirkuitMaks} ${d.satuan}/sirkuit (${f(h.kapasitasW, 0)} W)`,
    ...h.perFase.map(p => `- Fase ${p.fase}: ${p.sirkuit} sirkuit, ${f(p.watt / 1000)} kW, ${f(p.arus, 1)} A → MCB utama ${p.mcb} A`),
    ...h.sirkuit.map(c => `  C${c.no} (${c.fase}): ${c.unit} ${d.satuan}, ${f(c.watt, 0)} W, ${f(c.arus, 1)} A`),
    h.galat ?? '',
  ].filter(Boolean).join('\n');
}

/** Seksi lembar cetak: diagram + tabel sirkuit & fase. */
export function seksiCetakDaya(d: DataDaya, s: PengaturanDaya): Seksi[] {
  const h = susunDaya(d, s);
  return [
    { judul: 'Power connection (urutan kabel power per sirkuit)', jenis: 'html',
      html: `<div class="diagram">${svgDaya(d, h, s.arah)}<p style="margin:6px 0 0;font-size:11px;color:#475569">${esc(teksCara(s))} · C = sirkuit, huruf = fase</p>${h.galat ? `<p style="margin:4px 0 0;font-size:11px;color:#b91c1c">${esc(h.galat)}</p>` : ''}</div>` },
    { judul: 'Beban per fase & MCB utama', jenis: 'tabel', kepala: ['Fase', 'Sirkuit', 'Daya maks', 'Arus', 'MCB utama'], rataKanan: [1, 2, 3, 4],
      isi: h.perFase.map(p => [p.fase, String(p.sirkuit), `${f(p.watt / 1000)} kW`, `${f(p.arus, 1)} A`, `${p.mcb} A`]) },
    { judul: 'Pembagian sirkuit', jenis: 'tabel', kepala: ['Sirkuit', 'Fase', d.satuan === 'modul' ? 'Modul' : 'Cabinet', 'Daya maks', 'Arus', 'Masuk di'], rataKanan: [2, 3, 4],
      isi: h.sirkuit.map(c => [`C${c.no} · MCB ${s.mcb} A`, c.fase, String(c.unit), `${f(c.watt, 0)} W`, `${f(c.arus, 1)} A`, c.mulai ? `kolom ${c.mulai.c + 1}, baris ${c.mulai.r + 1}` : '—']) },
  ];
}

/** Gambar siap kirim: judul, ringkasan, diagram, legenda fase & sirkuit. */
function svgPosterDaya(d: DataDaya, s: PengaturanDaya, judul: string, sub: string): string {
  const h = susunDaya(d, s);
  const diagram = svgDaya(d, h, s.arah);
  const dw = Number(/\swidth="([\d.]+)"/.exec(diagram)?.[1] ?? 800), dh = Number(/\sheight="([\d.]+)"/.exec(diagram)?.[1] ?? 400);
  const W = Math.max(dw, 820) + 40;
  const baris = [...h.perFase.map(p => ({ warna: WARNA_FASE[p.fase], teks: `Fase ${p.fase}: ${p.sirkuit} sirkuit · ${f(p.watt / 1000)} kW · ${f(p.arus, 1)} A · MCB utama ${p.mcb} A` })),
    ...h.sirkuit.map(c => ({ warna: warnaPort(c.no), teks: `C${c.no} (${c.fase}) · ${c.unit} ${d.satuan} · ${f(c.watt, 0)} W · ${f(c.arus, 1)} A` }))];
  const kolom = baris.length > 24 ? 3 : baris.length > 8 ? 2 : 1, per = Math.ceil(baris.length / kolom), lk = (W - 40) / kolom;
  const yD = 92, yL = yD + dh + 16, H = yL + 30 + per * 19 + 34;
  const huruf = 'font-family="Segoe UI,Arial"';
  const legenda = baris.map((b, i) => {
    const x = 20 + Math.floor(i / per) * lk, y = yL + 30 + (i % per) * 19;
    return `<rect x="${x}" y="${y - 10}" width="11" height="11" rx="2" fill="${b.warna}"/><text x="${x + 17}" y="${y}" font-size="11.5" fill="#1e293b" ${huruf}>${esc(b.teks)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="0" y="0" width="${W}" height="62" fill="#b45309"/>
<text x="20" y="28" font-size="18" font-weight="800" fill="#ffffff" ${huruf}>${esc(judul)}</text>
<text x="20" y="48" font-size="12" fill="#fef3c7" ${huruf}>${esc(sub)}</text>
<text x="20" y="80" font-size="12" font-weight="600" fill="#334155" ${huruf}>${esc(`${h.sirkuit.length} sirkuit · total ${f(h.totalW / 1000)} kW maks · ${teksCara(s)}`)}</text>
${diagram.replace(/ style="[^"]*"/, '').replace('<svg ', `<svg x="${Math.round((W - dw) / 2)}" y="${yD}" `)}
<text x="20" y="${yL + 12}" font-size="11" font-weight="800" fill="#92400e" letter-spacing="0.6" ${huruf}>FASE &amp; SIRKUIT</text>
${legenda}
<text x="20" y="${H - 12}" font-size="10" fill="#94a3b8" ${huruf}>IndoVisual Professional Tools — Tools Team · angka daya = maksimum (putih penuh); verifikasi dengan datasheet &amp; instalatir listrik</text>
</svg>`;
}

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
