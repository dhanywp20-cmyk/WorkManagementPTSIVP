/**
 * scripts/impor-epson-tdc.mjs - Buat katalog proyektor Epson (lib/data/epson-tdc.json) dari data Epson Projector Throw
 * Distance Simulator resmi (https://download.epson.com.sg/tdc/V272/), format sama dengan katalog Panasonic
 * (desain3d/inti/katalogPanasonic.ts) supaya dipilih dengan cara yang sama.
 *
 * Jalankan: node scripts/impor-epson-tdc.mjs [url dasar simulator] [versi]
 *
 * Data simulator hanya DIBACA sebagai JSON (projectorSpec, projectorLensSpec, optionLensList, optionLensSpec,
 * brightness), tidak ada kode Epson yang dijalankan.
 *
 * Rumus jarak Epson per rasio sinyal, ujung wide & tele: L(cm) = a x diagonal(inci) + b (size2dist), jarak dari ujung
 * lensa ke layar - sama dengan titik ukur Desain 3D. Dikonversi seperti Panasonic:
 *   TR = a / 100 / 0,0254 x diagonal/lebar gambar,  b(Desain 3D) = -b / 100   ->  L = TR x lebar gambar - b
 * Lens shift: V / H min-max + batas kombinasi Hv (H penuh -> V hanya Hv min..Hv max), cara simulator Epson. Titik tengah
 * gambar boleh di segi enam (0,Vmin) (Hmax,Hvmin) (Hmax,Hvmax) (0,Vmax) (Hmin,Hvmax) (Hmin,Hvmin); disimpan sebagai
 * daerah gambar utuh (segi enam + persegi gambar = segi delapan simulator Epson) seperti poligon Panasonic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dasar = 'https://download.epson.com.sg/tdc/V272/', versi = '2.7.2'] = process.argv.slice(2);
const ambil = async (f) => {
  const r = await fetch(new URL(`static/data/${f}.json`, dasar));
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return r.json();
};
const [ps, pls, oll, ols, br] = await Promise.all(['projectorSpec', 'projectorLensSpec', 'optionLensList', 'optionLensSpec', 'brightness'].map(ambil));

const RASIO = { '16:10': [16, 10], '16:9': [16, 9], '4:3': [4, 3], '17:9': [17, 9], '21:9': [64, 27] };
const angka = (v) => { const x = Number(String(v ?? '').replace(/[, ]/g, '')); return Number.isFinite(x) ? x : 0; };
const bulat = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
/** Persen atau pecahan -> pecahan (aturan simulator Epson: |x| < 1 sudah pecahan). */
const pecahan = (x) => { const v = angka(x); return Math.abs(v) < 1 ? v : v / 100; };
/** Kelompok "Category" simulator Epson (findMatchingModel): 1..6, 0 = All. */
const GRUP = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 6: 3, 7: 3, 8: 4, 9: 5, 5: 6 };
const KATEGORI = [
  { v: 0, l: 'All' }, { v: 1, l: 'Standard / Classroom / Mobile' }, { v: 2, l: 'Short Throw / Ultra Short Throw' }, { v: 3, l: 'Signage / Lighting' },
  { v: 4, l: 'High Brightness (lens fixed)' }, { v: 5, l: 'High Brightness (optional lenses)' }, { v: 6, l: 'Home Theatre' },
];
function resolusiDari(r) {
  const n = String(r ?? '').replace(/\s+/g, '').toUpperCase();
  if (n.startsWith('WUXGA')) return 'WUXGA';
  if (n.startsWith('WXGA')) return 'WXGA';
  if (n.startsWith('SXGA+')) return 'SXGAP';
  if (n.startsWith('XGA')) return 'XGA';
  if (n.startsWith('FULLHD') || n.startsWith('FHD')) return 'FHD';
  if (n.startsWith('4K')) return '4K';
  return null;
}
/** Rasio panel native dari resolusi (lensa opsional menyimpan rasio sendiri, tidak selalu panel). */
const RASIO_RESOLUSI = { WUXGA: '16:10', WXGA: '16:10', SXGAP: '4:3', XGA: '4:3', FHD: '16:9', '4K': '16:9' };

/** Hull cembung (monotone chain), titik [x, y]. */
function hull(t) {
  const p = [...t].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const silang = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bawah = [], atas = [];
  for (const q of p) { while (bawah.length >= 2 && silang(bawah.at(-2), bawah.at(-1), q) <= 1e-12) bawah.pop(); bawah.push(q); }
  for (const q of p.reverse()) { while (atas.length >= 2 && silang(atas.at(-2), atas.at(-1), q) <= 1e-12) atas.pop(); atas.push(q); }
  return [...bawah.slice(0, -1), ...atas.slice(0, -1)];
}
/**
 * Daerah lens shift (poligon daerah gambar, satuan panel) dari angka Epson, atau null bila tanpa lens shift.
 * Titik tengah gambar: segi enam simulator Epson (Hv kosong = 0); daerah gambar = titik itu + persegi gambar.
 */
function poligonShift(s) {
  const vMin = pecahan(s.lensShiftVMin), vMax = pecahan(s.lensShiftVMax), hMin = pecahan(s.lensShiftHMin), hMax = pecahan(s.lensShiftHMax);
  if (vMin === vMax && hMin === hMax) return null;
  const hvMin = pecahan(s.lensShiftHvMin), hvMax = pecahan(s.lensShiftHvMax);
  //  Rentang satu arah (Vmin > 0 / Vmax < 0): Hv relatif terhadap ujung itu (I simulator Epson).
  const I = vMin > 0 ? vMin : vMax < 0 ? vMax : 0;
  const tengah = hMin === hMax
    ? [[hMin, vMin], [hMin, vMax]]
    : [[0, vMin], [hMax, hvMin + I], [hMax, hvMax + I], [0, vMax], [hMin, hvMax + I], [hMin, hvMin + I]];
  const titik = tengah.flatMap(([h, v]) => [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([a, b]) => [h + a, v + b]));
  return hull(titik).flatMap(([x, y]) => [bulat(x, 4), bulat(y, 4)]);
}

/** Koefisien per rasio sinyal dari entri lensa (ratio1..5, s2dWa1 ...). */
function koefisien(s) {
  const ar = {};
  let dMin = Infinity, dMaks = 0;
  for (let i = 1; i <= 5; i++) {
    const ra = s[`ratio${i}`];
    if (!RASIO[ra] || ar[ra]) continue;
    const aW = angka(s[`s2dWa${i}`]), aT = angka(s[`s2dTa${i}`]);
    if (!(aW > 0) || !(aT > 0)) continue;
    const [uw, uh] = RASIO[ra], diagPerLebar = Math.hypot(uw, uh) / uw;
    const w = [bulat((aW / 100 / 0.0254) * diagPerLebar), bulat(-angka(s[`s2dWb${i}`]) / 100)];
    const t = [bulat((aT / 100 / 0.0254) * diagPerLebar), bulat(-angka(s[`s2dTb${i}`]) / 100)];
    const [lo, hi] = w[0] <= t[0] ? [w, t] : [t, w];
    ar[ra] = [lo[0], hi[0], lo[1], hi[1]];
    dMin = Math.min(dMin, angka(s[`sizeWMin${i}`]) || Infinity);
    dMaks = Math.max(dMaks, angka(s[`sizeWMax${i}`]));
  }
  return { ar, d: [Number.isFinite(dMin) ? dMin : 0, dMaks] };
}
/** Tinggi gambar per inci diagonal (cm) pada rasio native. */
const tinggiPerInci = (ra) => { const [w, h] = RASIO[ra] ?? [16, 10]; return (2.54 * h) / Math.hypot(w, h); };

const brLensa = new Map(br.optionLens.map(x => [`${x.code}|${x.lensId}`, x]));
const daftarOpsi = new Map(oll.map(x => [x.code, x.lenses]));
const specOpsi = new Map(ols.map(x => [x.id, x]));
const specTetap = new Map(pls.map(x => [x.code, x]));

const hasil = [], terlihat = new Set();
for (const p of ps) {
  if (terlihat.has(p.name)) continue;
  const lensa = [];
  const res = resolusiDari(p.resolution);
  const tambah = (nama, s, shift, lm, tetapLensa) => {
    const { ar, d } = koefisien(s);
    const rasio = Object.keys(ar);
    if (!rasio.length) return;
    const pilihan = RASIO_RESOLUSI[res] ?? (tetapLensa && RASIO[s.aspectRatio] ? s.aspectRatio : null);
    const native = pilihan && ar[pilihan] ? pilihan : rasio[0];
    const pg = poligonShift(shift);
    let off = 0, khusus = false;
    if (!pg) {
      off = pecahan(shift.lensShiftVMin);
      //  Tanpa lens shift: posisi tetap gambar dari rumus simulator Epson - lensa "long lens" (wv) & ultra short throw (v1b).
      const i1 = [1, 2, 3, 4, 5].find(i => s[`ratio${i}`] === native) ?? 1;
      const hpi = tinggiPerInci(native);
      if (tetapLensa && p.type === 0 && angka(s[`tv1${i1}`]) && angka(s[`tv2${i1}`]) && angka(s[`wv2${i1}`])) off = angka(s[`wv2${i1}`]) / hpi - 0.5;
      if (p.category === 4) {
        //  UST: (tinggi/2 + v1b(D) - mu) / tinggi, diambil di tengah rentang ukuran layar (Epson: sedikit berubah ikut ukuran).
        const D = (d[0] + d[1]) / 2, h = hpi * D;
        off = (h / 2 + angka(s[`v1bWa${i1}`]) * D + angka(s[`v1bWb${i1}`]) - angka(s.mu) / 10) / h;
        khusus = true;
      }
    }
    if (p.category === 4) khusus = true;
    const zoom = String(s.throwRatio ?? '').includes('-') || Object.values(ar).some(k => Math.abs(k[1] - k[0]) > 1e-6);
    lensa.push({
      n: nama, z: zoom ? 1 : 0, ar: Object.fromEntries(Object.entries(ar).sort(([a], [b]) => (a === native ? -1 : b === native ? 1 : 0))),
      pg, off: bulat(off, 4), ...(khusus ? { k: 1 } : {}), d, ket: String(s.throwRatio ?? '').slice(0, 60), ...(lm ? { lm } : {}),
    });
  };
  if (p.lensExchange) {
    for (const id of daftarOpsi.get(p.code) ?? []) {
      const s = specOpsi.get(id);
      if (!s) continue;
      const b = brLensa.get(`${p.code}|${id}`);
      //  Lens shift & lumen per KOMBINASI proyektor + lensa (brightness.json); tanpa entri = angka lensa.
      tambah(String(s.name ?? id).replace(/\s+V\d+H\w+$/, ''), s, b ?? s, b ? angka(b.brightness) : 0, false);
    }
  } else {
    const s = specTetap.get(p.code);
    if (s) tambah('Lensa bawaan', s, s, 0, true);
  }
  if (!lensa.length) continue;
  terlihat.add(p.name);
  const native = Object.keys(lensa[0].ar)[0];
  const kontras = angka(String(p.contrast ?? '').split(':')[0]);
  hasil.push({
    n: p.name, kat: GRUP[p.category] ?? 1, a: native, r: res, lm: angka(p.whiteNormal),
    ...(kontras > 1 ? { c: kontras } : {}), as: [...new Set(lensa.flatMap(l => Object.keys(l.ar)))], l: lensa,
  });
}
hasil.sort((x, y) => x.n.localeCompare(y.n));
const keluar = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'data', 'epson-tdc.json');
fs.writeFileSync(keluar, JSON.stringify({ versi, sumber: 'Epson Projector Throw Distance Simulator', merek: 'Epson', kategori: KATEGORI, model: hasil }));
console.log(`${hasil.length} model, ${hasil.reduce((a, h) => a + h.l.length, 0)} lensa -> ${keluar} (${(fs.statSync(keluar).size / 1024).toFixed(0)} KB)`);
