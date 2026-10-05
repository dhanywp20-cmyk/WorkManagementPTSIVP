'use client';
import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { hitungKoneksi, type SudutMulai } from '@/lib/av-hitung';
import { Angka, Segmen, Kartu, Nilai, Catatan, f } from './ui';
import { esc, type Seksi } from './cetak';

/** Pengaturan screen connection (disimpan bersama hitungan LED). */
export interface PengaturanKoneksi {
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z'; bagi: 'baris' | 'penuh';
  /** Batas beban port (%). */ beban: number;
  /** Jumlah modul/cabinet per receiving card (mendatar × tegak); null = otomatis. */ rcKol: number | null; rcBaris: number | null;
  /** Port LAN per controller; null = ikut hardware terpilih. */ ppk: number | null;
}
export const KONEKSI_AWAL: PengaturanKoneksi = {
  mulai: 'kiri-atas', arah: 'horizontal', pola: 'S', bagi: 'baris', beban: 100, rcKol: null, rcBaris: null, ppk: null,
};

/** Pengaturan dari hitungan tersimpan: nilai asing / tidak sah diganti bawaan. */
export function bersihkanKoneksi(x: unknown): PengaturanKoneksi {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const pilih = <T extends string>(v: unknown, sah: readonly T[], awal: T): T => (sah.includes(v as T) ? (v as T) : awal);
  const bulat = (v: unknown, min: number, maks: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, Math.round(v))) : null);
  const A = KONEKSI_AWAL;
  return {
    mulai: pilih(o.mulai, ['kiri-atas', 'kanan-atas', 'kiri-bawah', 'kanan-bawah'] as const, A.mulai),
    arah: pilih(o.arah, ['horizontal', 'vertikal'] as const, A.arah),
    pola: pilih(o.pola, ['S', 'Z'] as const, A.pola),
    bagi: pilih(o.bagi, ['baris', 'penuh'] as const, A.bagi),
    beban: bulat(o.beban, 10, 100) ?? A.beban,
    rcKol: bulat(o.rcKol, 1, 1000), rcBaris: bulat(o.rcBaris, 1, 1000), ppk: bulat(o.ppk, 0, 256),
  };
}

/** Data layar dari kalkulator. */
export interface DataKoneksi {
  /** Susunan unit (modul / cabinet). */ kolom: number; baris: number;
  /** Ukuran unit (mm) & pixel per unit. */ wUnit: number; hUnit: number; pxX: number; pxY: number;
  satuan: 'modul' | 'cabinet';
  pxPerPort: number; /** Perkiraan port dari total pixel. */ portIdeal: number;
  /** Port per unit hardware & namanya (0 / null = belum ada). */ ppkHw: number; namaHw: string | null;
}

const WARNA_PORT = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#059669', '#b91c1c', '#7c3aed'];
export const warnaPort = (p: number) => WARNA_PORT[(p - 1) % WARNA_PORT.length];
const SUDUT: { v: SudutMulai; l: string; ikon: string }[] = [
  { v: 'kiri-atas', l: 'Kiri atas', ikon: '↖' }, { v: 'kanan-atas', l: 'Kanan atas', ikon: '↗' },
  { v: 'kiri-bawah', l: 'Kiri bawah', ikon: '↙' }, { v: 'kanan-bawah', l: 'Kanan bawah', ikon: '↘' },
];
/** Batas umum area satu receiving card (512 × 512 px). */
const PX_RC_UMUM = 512 * 512;

/** Grid receiving card & urutan kabelnya. Unit di tepi yang tersisa digabung ke receiving card terakhir. */
export function susunKoneksi(d: DataKoneksi, s: PengaturanKoneksi) {
  const otoKol = d.satuan === 'cabinet' ? 1 : Math.max(1, Math.round(500 / Math.max(1, d.wUnit)));
  const otoBaris = d.satuan === 'cabinet' ? 1 : Math.max(1, Math.round(500 / Math.max(1, d.hUnit)));
  const rcKol = Math.min(d.kolom, Math.max(1, Math.round(s.rcKol ?? otoKol)));
  const rcBaris = Math.min(d.baris, Math.max(1, Math.round(s.rcBaris ?? otoBaris)));
  const K = Math.ceil(d.kolom / rcKol), B = Math.ceil(d.baris / rcBaris);
  const pxRC = { x: rcKol * d.pxX, y: rcBaris * d.pxY };
  const ppk = Math.max(0, Math.round(s.ppk ?? d.ppkHw));
  //  Receiving card di tepi yang lebih kecil dihitung penuh: perkiraan aman.
  const hasil = hitungKoneksi({
    kolom: K, baris: B, pxPerRC: pxRC.x * pxRC.y, pxPerPort: d.pxPerPort,
    mulai: s.mulai, arah: s.arah, pola: s.pola, bagi: s.bagi, bebanMaks: s.beban, portPerKartu: ppk,
  });
  return { rcKol, rcBaris, otoKol, otoBaris, K, B, pxRC, ppk, hasil, arah: s.arah };
}
type Susunan = ReturnType<typeof susunKoneksi>;

const namaPort = (t: Susunan, port: number) =>
  t.ppk > 0 && t.hasil.jumlahKartu > 1 ? `Controller ${Math.ceil(port / t.ppk)} · port ${((port - 1) % t.ppk) + 1}` : `Port ${port}`;

/** Diagram koneksi (SVG mandiri) - dipakai di layar, cetak, dan unduhan. */
export function svgKoneksi(d: DataKoneksi, t: Susunan, judul = ''): string {
  const lebarMm = d.kolom * d.wUnit, tinggiMm = d.baris * d.hUnit;
  const skala = Math.min(860 / Math.max(1, lebarMm), 430 / Math.max(1, tinggiMm));
  const W = lebarMm * skala, H = tinggiMm * skala;
  const ox = 52, oy = judul ? 52 : 30;
  const xs = Array.from({ length: t.K + 1 }, (_, i) => ox + Math.min(d.kolom, i * t.rcKol) * d.wUnit * skala);
  const ys = Array.from({ length: t.B + 1 }, (_, i) => oy + Math.min(d.baris, i * t.rcBaris) * d.hUnit * skala);
  const pusat = (c: number, r: number) => [(xs[c] + xs[c + 1]) / 2, (ys[r] + ys[r + 1]) / 2];
  let selMin = Infinity;
  for (let i = 0; i < t.K; i++) selMin = Math.min(selMin, xs[i + 1] - xs[i]);
  for (let i = 0; i < t.B; i++) selMin = Math.min(selMin, ys[i + 1] - ys[i]);
  const banyak = t.K * t.B > 2500;
  const fs = Math.min(12, selMin * 0.24);
  const n = (v: number) => Math.round(v * 10) / 10;
  const out: string[] = [];
  out.push(`<rect x="${ox}" y="${oy}" width="${n(W)}" height="${n(H)}" fill="#f8fafc"/>`);
  //  Sel receiving card diwarnai per port.
  for (const s of t.hasil.sel) {
    out.push(`<rect x="${n(xs[s.c])}" y="${n(ys[s.r])}" width="${n(xs[s.c + 1] - xs[s.c])}" height="${n(ys[s.r + 1] - ys[s.r])}" fill="${warnaPort(s.port)}" fill-opacity="0.17"/>`);
  }
  //  Garis modul/cabinet tipis di dalam receiving card.
  const tipis: string[] = [];
  if ((t.rcKol > 1 || t.rcBaris > 1) && d.kolom <= 160 && d.baris <= 160) {
    for (let i = 1; i < d.kolom; i++) if (i % t.rcKol) { const x = n(ox + i * d.wUnit * skala); tipis.push(`<line x1="${x}" y1="${oy}" x2="${x}" y2="${n(oy + H)}"/>`); }
    for (let i = 1; i < d.baris; i++) if (i % t.rcBaris) { const y = n(oy + i * d.hUnit * skala); tipis.push(`<line x1="${ox}" y1="${y}" x2="${n(ox + W)}" y2="${y}"/>`); }
  }
  if (tipis.length) out.push(`<g stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="3 2">${tipis.join('')}</g>`);
  const batas: string[] = [];
  for (let i = 1; i < t.K; i++) batas.push(`<line x1="${n(xs[i])}" y1="${oy}" x2="${n(xs[i])}" y2="${n(oy + H)}"/>`);
  for (let i = 1; i < t.B; i++) batas.push(`<line x1="${ox}" y1="${n(ys[i])}" x2="${n(ox + W)}" y2="${n(ys[i])}"/>`);
  out.push(`<g stroke="#64748b" stroke-width="${banyak ? 0.3 : 0.8}">${batas.join('')}</g>`);
  out.push(`<rect x="${ox}" y="${oy}" width="${n(W)}" height="${n(H)}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`);
  //  Rantai kabel per port + panah arah.
  const tebal = Math.max(1, Math.min(2.5, selMin * 0.06));
  const panah = Math.max(2.5, Math.min(6, selMin * 0.13));
  const perPort = new Map<number, number[][]>();
  for (const s of t.hasil.sel) { const a = perPort.get(s.port) ?? []; a.push(pusat(s.c, s.r)); perPort.set(s.port, a); }
  if (!banyak) {
    perPort.forEach((titik, port) => {
      const warna = warnaPort(port);
      out.push(`<polyline points="${titik.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${warna}" stroke-width="${n(tebal)}" stroke-linejoin="round" stroke-opacity="0.85"/>`);
      if (selMin >= 12) {
        const seg: string[] = [];
        for (let i = 1; i < titik.length; i++) {
          const [x0, y0] = titik[i - 1], [x1, y1] = titik[i];
          const pj = Math.hypot(x1 - x0, y1 - y0); if (pj < 1) continue;
          const ux = (x1 - x0) / pj, uy = (y1 - y0) / pj, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          const bx = mx - panah * ux, by = my - panah * uy;
          seg.push(`${n(mx + panah * ux)},${n(my + panah * uy)} ${n(bx - 0.8 * panah * uy)},${n(by + 0.8 * panah * ux)} ${n(bx + 0.8 * panah * uy)},${n(by - 0.8 * panah * ux)}`);
        }
        out.push(`<g fill="${warna}">${seg.map(p => `<polygon points="${p}"/>`).join('')}</g>`);
      }
    });
  }
  //  Titik masuk tiap port. Di tepi layar: label di luar tepi terdekat (seri: sisi searah kabel didahulukan).
  //  Di tengah layar (zona / isi penuh): label langsung di sel pertama.
  const utama = (sisi: string) => ((sisi === 'kiri' || sisi === 'kanan') === (t.arah === 'horizontal') ? 1 : 0);
  const masuk = t.hasil.port.map(p => {
    const jarak = [
      { sisi: 'kiri', v: p.mulai.c }, { sisi: 'kanan', v: t.K - 1 - p.mulai.c },
      { sisi: 'atas', v: p.mulai.r }, { sisi: 'bawah', v: t.B - 1 - p.mulai.r },
    ].sort((a, b) => a.v - b.v || utama(b.sisi) - utama(a.sisi));
    return { p, sisi: jarak[0].v === 0 ? jarak[0].sisi : null };
  });
  const diSel = new Set(masuk.filter(m => !m.sisi).map(m => m.p.port));
  const adaLabel = !banyak && fs >= 5.5;
  //  Label "port-urutan" di tiap receiving card.
  if (adaLabel) {
    const lbl = t.hasil.sel.filter(s => !(s.urut === 1 && diSel.has(s.port))).map(s => {
      const [x, y] = pusat(s.c, s.r);
      return `<text x="${n(x)}" y="${n(y - fs * 0.55)}">${s.port}-${s.urut}</text>`;
    });
    out.push(`<g font-size="${n(fs)}" font-weight="700" text-anchor="middle" fill="#0f172a" font-family="Segoe UI,Arial" paint-order="stroke" stroke="#ffffff" stroke-width="2.4">${lbl.join('')}</g>`);
  }
  for (const { p, sisi } of masuk) {
    const warna = warnaPort(p.port);
    const [cx, cy] = pusat(p.mulai.c, p.mulai.r);
    const r = Math.max(3, Math.min(7, selMin * 0.16));
    out.push(`<circle cx="${n(cx)}" cy="${n(cy + (adaLabel ? r * 0.9 : 0))}" r="${n(r)}" fill="${warna}" stroke="#fff" stroke-width="1.2"/>`);
    const teks = `P${p.port}`;
    if (!sisi) {
      const fb = Math.max(6, Math.min(10, fs + 1)), bw = 5 + teks.length * fb * 0.62, bh = fb + 4;
      const by = adaLabel ? cy - fs * 0.55 - fb * 0.85 : cy - bh / 2;
      out.push(`<rect x="${n(cx - bw / 2)}" y="${n(by)}" width="${n(bw)}" height="${n(bh)}" rx="3" fill="${warna}" stroke="#fff" stroke-width="1"/>`);
      out.push(`<text x="${n(cx)}" y="${n(by + bh - 3)}" font-size="${n(fb)}" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${teks}</text>`);
      continue;
    }
    const lw = 8 + teks.length * 6.4, lh = 15;
    const [lx, ly] = sisi === 'kiri' ? [ox - lw - 6, cy - lh / 2] : sisi === 'kanan' ? [ox + W + 6, cy - lh / 2]
      : sisi === 'atas' ? [cx - lw / 2, oy - lh - 5] : [cx - lw / 2, oy + H + 5];
    const [ex, ey] = sisi === 'kiri' ? [ox, cy] : sisi === 'kanan' ? [ox + W, cy] : sisi === 'atas' ? [cx, oy] : [cx, oy + H];
    const [tx, ty] = sisi === 'kiri' ? [lx + lw, cy] : sisi === 'kanan' ? [lx, cy] : sisi === 'atas' ? [cx, ly + lh] : [cx, ly];
    out.push(`<line x1="${n(tx)}" y1="${n(ty)}" x2="${n(ex)}" y2="${n(ey)}" stroke="${warna}" stroke-width="1.6"/>`);
    out.push(`<rect x="${n(lx)}" y="${n(ly)}" width="${n(lw)}" height="${lh}" rx="4" fill="${warna}"/>`);
    out.push(`<text x="${n(lx + lw / 2)}" y="${n(ly + 11)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${teks}</text>`);
  }
  const fm = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const nUnit = d.satuan === 'modul' ? 'modul' : 'cabinet';
  out.push(`<text x="${n(ox + W / 2)}" y="${n(oy + H + 36)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial">${fm(lebarMm / 1000)} m · ${d.kolom} ${nUnit} · ${d.kolom * d.pxX} px · ${t.K} receiving card</text>`);
  out.push(`<text x="${n(ox - 34)}" y="${n(oy + H / 2)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial" transform="rotate(-90 ${n(ox - 34)} ${n(oy + H / 2)})">${fm(tinggiMm / 1000)} m · ${d.baris} ${nUnit} · ${d.baris * d.pxY} px</text>`);
  if (judul) out.push(`<text x="${ox}" y="20" font-size="13" font-weight="700" fill="#0f172a" font-family="Segoe UI,Arial">${esc(judul)}</text>`);
  const lebar = n(W + ox + 52), tinggi = n(H + oy + 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}" viewBox="0 0 ${lebar} ${tinggi}" style="max-width:100%;height:auto">${out.join('')}</svg>`;
}

const teksSudut = (s: SudutMulai) => SUDUT.find(x => x.v === s)!.l.toLowerCase();

/** Satu baris ringkasan untuk Salin/WA. */
export function ringkasanKoneksi(d: DataKoneksi, s: PengaturanKoneksi): string {
  const t = susunKoneksi(d, s), k = t.hasil;
  return `Screen connection: ${t.K}×${t.B} receiving card (${t.pxRC.x}×${t.pxRC.y} px), ${k.jumlahPort} port LAN maks ${k.rcPerPortMaks} RC/port`
    + `${t.ppk > 0 ? `, ${k.jumlahKartu} controller × ${t.ppk} port` : ''}; mulai ${teksSudut(s.mulai)}, ${s.arah === 'horizontal' ? 'mendatar' : 'tegak'} pola ${s.pola}`;
}

/** Seksi lembar cetak: diagram + tabel port. */
export function seksiCetakKoneksi(d: DataKoneksi, s: PengaturanKoneksi): Seksi[] {
  const t = susunKoneksi(d, s), k = t.hasil;
  const ket = `${t.K} × ${t.B} receiving card · ${t.pxRC.x} × ${t.pxRC.y} px per receiving card · mulai ${teksSudut(s.mulai)}, kabel ${s.arah === 'horizontal' ? 'mendatar' : 'tegak'} pola ${s.pola} · label sel = port-urutan`;
  return [
    { judul: 'Screen connection (urutan kabel data)', jenis: 'html',
      html: `<div class="diagram">${svgKoneksi(d, t)}<p style="margin:6px 0 0;font-size:11px;color:#475569">${esc(ket)}</p>${k.galat ? `<p style="margin:4px 0 0;font-size:11px;color:#b91c1c">${esc(k.galat)}</p>` : ''}</div>` },
    { judul: 'Pembagian port LAN', jenis: 'tabel', kepala: ['Port', 'Receiving card', 'Pixel', 'Beban', 'Masuk di'], rataKanan: [1, 2, 3],
      isi: k.port.map(p => [namaPort(t, p.port), String(p.jumlah), p.px.toLocaleString('id-ID'), `${f(p.beban, 0)}%`, `kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}`]) },
  ];
}

export function KartuKoneksi({ d, s, onUbah, namaFile }: {
  d: DataKoneksi; s: PengaturanKoneksi; onUbah: (s: PengaturanKoneksi) => void; namaFile: string;
}) {
  const t = useMemo(() => susunKoneksi(d, s), [d, s]);
  const svg = useMemo(() => svgKoneksi(d, t), [d, t]);
  const k = t.hasil;
  const ubah = (p: Partial<PengaturanKoneksi>) => onUbah({ ...s, ...p });
  const nUnit = d.satuan === 'modul' ? 'modul' : 'cabinet';
  const zona = Math.ceil((s.arah === 'horizontal' ? t.K : t.B) / k.rcPerPortMaks);
  const rataBeban = k.port.length ? k.port.reduce((a, p) => a + p.beban, 0) / k.port.length : 0;
  const unduh = () => {
    const isi = svgKoneksi(d, t, `Screen connection - ${namaFile}`);
    const url = URL.createObjectURL(new Blob([isi], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url; a.download = `screen-connection-${namaFile.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'led'}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Kartu judul="Screen connection (urutan kabel data)" aksi={
      <button type="button" onClick={unduh} title="Unduh diagram SVG"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 print:hidden">
        <Download size={14} /> Unduh SVG
      </button>
    }>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] items-start">
        <div className="space-y-3 min-w-0">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Receiving card pertama</span>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Pojok mulai">
              {SUDUT.map(o => {
                const on = o.v === s.mulai;
                return (
                  <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => ubah({ mulai: o.v })}
                    className={`rounded-xl border px-2 py-1.5 text-[12.5px] font-semibold text-left ${on ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    <span className="mr-1.5 text-base leading-none" aria-hidden>{o.ikon}</span>{o.l}
                  </button>
                );
              })}
            </div>
          </div>
          <Segmen label="Arah kabel" nilai={s.arah} onUbah={v => ubah({ arah: v })}
            opsi={[{ v: 'horizontal', l: 'Mendatar' }, { v: 'vertikal', l: 'Tegak' }]} />
          <Segmen label="Pola" nilai={s.pola} onUbah={v => ubah({ pola: v })}
            opsi={[{ v: 'S', l: 'S · bolak-balik' }, { v: 'Z', l: 'Z · balik ke awal' }]} />
          <Segmen label="Pembagian port" nilai={s.bagi} onUbah={v => ubah({ bagi: v })}
            opsi={[{ v: 'baris', l: s.arah === 'horizontal' ? 'Baris utuh' : 'Kolom utuh' }, { v: 'penuh', l: 'Isi penuh' }]} />
          <Angka label="Batas beban port" nilai={s.beban} satuan="%" step={1}
            onUbah={v => v >= 10 && v <= 100 && ubah({ beban: Math.round(v) })}
            bantuan={`Maks ${f(Math.floor((d.pxPerPort * s.beban) / 100) / 1000, 0)} rb dari ${f(d.pxPerPort / 1000, 0)} rb px/port`} />
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Angka label={`${nUnit} mendatar`} nilai={t.rcKol} step={1} onUbah={v => v >= 1 && ubah({ rcKol: Math.round(v) })} />
              <Angka label={`${nUnit} tegak`} nilai={t.rcBaris} step={1} onUbah={v => v >= 1 && ubah({ rcBaris: Math.round(v) })} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Per receiving card: {t.rcKol}×{t.rcBaris} {nUnit} = {t.pxRC.x}×{t.pxRC.y} px{s.rcKol === null && s.rcBaris === null && ' (otomatis)'}
              {(s.rcKol !== null || s.rcBaris !== null) && (
                <button type="button" onClick={() => ubah({ rcKol: null, rcBaris: null })} className="ml-1.5 font-semibold text-blue-700 hover:underline">Otomatis</button>
              )}
            </p>
          </div>
          <Angka label="Port per controller" nilai={t.ppk} step={1} satuan="port" onUbah={v => v >= 0 && ubah({ ppk: Math.round(v) })}
            bantuan={s.ppk === null ? (d.namaHw ? `Dari ${d.namaHw}` : 'Belum ada hardware: isi manual') : 'Diisi manual'} />
          {s.ppk !== null && d.ppkHw > 0 && (
            <button type="button" onClick={() => ubah({ ppk: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut hardware ({d.ppkHw} port)</button>
          )}
        </div>

        <div className="space-y-3 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Nilai label="Receiving card" nilai={k.sel.length} ket={`${t.K} kolom × ${t.B} baris`} />
            <Nilai label="Port LAN dipakai" nilai={k.jumlahPort} ket={`maks ${k.rcPerPortMaks} RC/port`} nada={k.jumlahPort > d.portIdeal ? 'awas' : undefined} />
            <Nilai label="Controller" nilai={t.ppk > 0 ? k.jumlahKartu : '-'} ket={t.ppk > 0 ? `${t.ppk} port/unit` : 'isi port per controller'} />
            <Nilai label="Beban rata-rata" nilai={f(rataBeban, 0)} satuan="%" ket="per port" />
          </div>
          {k.galat && <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{k.galat}</p>}
          {t.pxRC.x * t.pxRC.y > PX_RC_UMUM && !k.galat && (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Area per receiving card {t.pxRC.x}×{t.pxRC.y} px melebihi kapasitas receiving card umum (±512×512 px). Kecilkan jumlah {nUnit} per receiving card atau cek tipe receiving card.
            </p>
          )}
          {s.bagi === 'baris' && zona > 1 && (
            <p className="text-[12.5px] text-slate-700">
              Satu {s.arah === 'horizontal' ? 'baris' : 'kolom'} ({s.arah === 'horizontal' ? t.K : t.B} receiving card) melebihi kapasitas port ({k.rcPerPortMaks}), jadi layar dibagi <b>{zona} zona</b> yang dikabel terpisah.
            </p>
          )}
          {k.jumlahPort > d.portIdeal && (
            <p className="text-[12.5px] text-amber-800">
              Satu receiving card tidak bisa dibagi ke dua port, jadi port aktual ({k.jumlahPort}) lebih banyak dari perkiraan total pixel ({d.portIdeal}).
              {s.bagi === 'baris' && ' Pilih "Isi penuh" untuk menghemat port.'}
            </p>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-2 overflow-x-auto [&>svg]:mx-auto [&>svg]:block" role="img"
            aria-label={`Diagram koneksi ${k.jumlahPort} port untuk ${k.sel.length} receiving card`}
            dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-600 sticky top-0">
                <tr>
                  <th className="text-left font-bold px-3 py-2">Port</th>
                  <th className="text-right font-bold px-3 py-2">RC</th>
                  <th className="text-right font-bold px-3 py-2">Pixel</th>
                  <th className="text-left font-bold px-3 py-2 w-40">Beban</th>
                  <th className="text-left font-bold px-3 py-2">Masuk di</th>
                </tr>
              </thead>
              <tbody>
                {k.port.map(p => (
                  <tr key={p.port} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: warnaPort(p.port) }} />{namaPort(t, p.port)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.jumlah}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.px.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                          <div className={`h-full rounded-full ${p.beban > 100 ? 'bg-rose-600' : p.beban > 85 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, p.beban)}%` }} />
                        </div>
                        <span className="tabular-nums w-9 text-right">{f(p.beban, 0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">kolom {p.mulai.c + 1}, baris {p.mulai.r + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Catatan>Label sel = port-urutan receiving card; P1, P2, … = titik masuk kabel LAN. Receiving card di tepi yang lebih kecil dihitung penuh (aman). Samakan dengan konfigurasi di NovaLCT (Screen Configuration → Screen Connection) saat instalasi.</Catatan>
    </Kartu>
  );
}
