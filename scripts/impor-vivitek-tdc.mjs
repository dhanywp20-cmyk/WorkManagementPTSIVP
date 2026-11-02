/**
 * scripts/impor-vivitek-tdc.mjs - Buat katalog proyektor Vivitek (lib/data/vivitek-tdc.json) dari data Vivitek
 * Projection Simulator resmi (https://www.vivitekcorp.com/simulator/), format sama dengan katalog Panasonic
 * (desain3d/inti/katalogPanasonic.ts).
 *
 * Jalankan:
 *   node scripts/impor-vivitek-tdc.mjs arsip/tdc/vivitek-2026-11-02     dari ARSIP lokal (tanpa internet)
 *   node scripts/impor-vivitek-tdc.mjs [url simulator] [versi]           dari situs Vivitek; data mentahnya sekaligus
 *                                                                        diarsipkan ke arsip/tdc/vivitek-<versi = tanggal>/
 *
 * Data simulator tertanam di bundel JS sebagai JSON.parse('...') per modul (dataSource/vvkProjectorModels.json,
 * vvkOptionalLens.json, vvkProjectorTypes.json) - hanya teks JSON-nya yang DIBACA (dan diarsipkan sebagai berkas JSON
 * dengan nama yang sama), kode Vivitek tidak dijalankan.
 *
 * Rumus simulator Vivitek: lebar gambar = jarak / throw ratio (rasio panel native, b = 0). Model ultra short throw
 * memakai tabel TR per diagonal (ustTR) - disederhanakan ke L = TR x lebar - b (regresi; selisih < 1 mm di tabelnya).
 * Lens shift: kotak V / H (% tinggi / lebar gambar) dari model; posisi vertikal Vivitek = Offset (% setengah tinggi,
 * 100 = tepi gambar di sumbu lensa) + 2 x shift V -> pecahan tinggi gambar Desain 3D = Offset / 200 + shift / 100.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMA = ['vvkProjectorModels', 'vvkOptionalLens', 'vvkProjectorTypes'];
const [sumberArg = 'https://www.vivitekcorp.com/simulator/', versiArg] = process.argv.slice(2);
const lokal = fs.existsSync(sumberArg) && fs.statSync(sumberArg).isDirectory();
const versi = versiArg ?? (lokal ? path.basename(sumberArg).replace(/^vivitek-/, '') : new Date().toISOString().slice(0, 10));
const arsip = lokal ? sumberArg : path.join(akar, 'arsip', 'tdc', `vivitek-${versi}`);
const BS = String.fromCharCode(92), SQ = "'";
let js = '', app = '';
if (!lokal) {
  const html = await (await fetch(sumberArg)).text();
  app = html.match(/js\/app\.[0-9a-f]+\.js/)?.[0] ?? '';
  if (!app) throw new Error('bundel app.*.js tidak ditemukan');
  js = await (await fetch(new URL(app, sumberArg))).text();
}

/** Isi JSON modul dataSource/<nama>.json: arsip lokal, atau dari bundel (id modul dari peta webpack, lalu literal JSON.parse('...')). */
function modul(nama) {
  if (lokal) return JSON.parse(fs.readFileSync(path.join(arsip, `${nama}.json`), 'utf8'));
  const id = js.match(new RegExp(`"\\./dataSource/${nama}\\.json":"([0-9a-f]+)"`))?.[1];
  if (!id) throw new Error(`${nama}: id modul tidak ditemukan`);
  const kepala = `${id}:function(t){t.exports=JSON.parse('`;
  let j = js.indexOf(kepala);
  if (j < 0) throw new Error(`${nama}: modul ${id} tidak ditemukan`);
  j += kepala.length;
  let t = '';
  for (; j < js.length && js[j] !== SQ; j++) {
    if (js[j] === BS) { const n = js[j + 1]; t += n === SQ ? SQ : js[j] + n; j++; } else t += js[j];
  }
  fs.mkdirSync(arsip, { recursive: true });
  fs.writeFileSync(path.join(arsip, `${nama}.json`), t);
  return JSON.parse(t);
}
const { projectorModels } = modul('vvkProjectorModels');
const { optionalLens } = modul('vvkOptionalLens');
const { projectorTypes } = modul('vvkProjectorTypes');
if (!lokal) {
  fs.writeFileSync(path.join(arsip, 'SUMBER.md'), [
    `# Vivitek Projection Simulator ${versi}`, '',
    `Diambil ${new Date().toISOString().slice(0, 10)} dari ${new URL(app, sumberArg)}: modul data ${NAMA.map(n => `dataSource/${n}.json`).join(', ')} (teks JSON persis dari bundel).`,
    `Buat ulang katalog tanpa internet: \`node scripts/impor-vivitek-tdc.mjs ${path.relative(akar, arsip).split(path.sep).join('/')}\``, '',
  ].join('\n'));
}

const RASIO = { '16:10': [16, 10], '16:9': [16, 9], '4:3': [4, 3] };
const bulat = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
const angka = (v) => { const x = Number(String(v ?? '').replace(/[, ]/g, '')); return Number.isFinite(x) ? x : 0; };
const RESOLUSI = { WUXGA: 'WUXGA', WXGA: 'WXGA', XGA: 'XGA', '1080p': 'FHD', '4K-UHD': '4K' };
const KATEGORI = [{ v: 0, l: 'All' }, ...projectorTypes.map((t, i) => ({ v: i + 1, l: t.Type }))];
const katModel = new Map(projectorTypes.flatMap((t, i) => t.Models.map(m => [m, i + 1])));
const lensaOpsi = new Map(optionalLens.map(l => [l['Part Name'], l]));

/** Lebar gambar per inci diagonal (m) pada rasio [w, h]. */
const lebarPerInci = ([w, h]) => (0.0254 * w) / Math.hypot(w, h);
/**
 * Koefisien per rasio sinyal dari TR native (relatif lebar panel): sinyal lebih sempit dari panel = pillarbox (lebar
 * gambar mengecil -> TR terhadap lebar gambar membesar); lebih lebar = letterbox (lebar sama). b tidak berubah.
 */
function koefisien(native, trW, trT, b) {
  const [pw, ph] = RASIO[native];
  const ar = {};
  for (const [ra, [w, h]] of Object.entries(RASIO)) {
    const f = Math.min(1, (w / h) / (pw / ph));
    ar[ra] = [bulat(trW / f), bulat(trT / f), bulat(b), bulat(b)];
  }
  return Object.fromEntries(Object.entries(ar).sort(([a]) => (a === native ? -1 : 0)));
}
/** Tabel ustTR (diagonal -> TR) -> [TR, b] garis L = TR x W - b terbaik (kuadrat terkecil). */
function dariUst(tabel, native) {
  const t = Object.entries(tabel).map(([d, tr]) => { const W = Number(d) * lebarPerInci(RASIO[native]); return [W, tr * W]; });
  if (t.length < 2) return null;
  const n = t.length, sx = t.reduce((a, [x]) => a + x, 0), sy = t.reduce((a, [, y]) => a + y, 0);
  const sxx = t.reduce((a, [x]) => a + x * x, 0), sxy = t.reduce((a, [x, y]) => a + x * y, 0);
  const tr = (n * sxy - sx * sy) / (n * sxx - sx * sx), c = (sy - tr * sx) / n;
  return [tr, -c];
}
/** Daerah lens shift (poligon daerah gambar, satuan panel) atau offset tetap. */
function shift(lensShift, offset) {
  const pusat = angka(offset) / 200;
  const v = [angka(lensShift?.Vertical?.min) / 100, angka(lensShift?.Vertical?.max) / 100];
  const h = [angka(lensShift?.Horizontal?.min) / 100, angka(lensShift?.Horizontal?.max) / 100];
  if (v[0] === v[1] && h[0] === h[1]) return { pg: null, off: bulat(pusat + v[0], 4) };
  const [v0, v1] = [pusat + v[0], pusat + v[1]];
  return { pg: [h[0] - 0.5, v0 - 0.5, h[1] + 0.5, v0 - 0.5, h[1] + 0.5, v1 + 0.5, h[0] - 0.5, v1 + 0.5].map(x => bulat(x, 4)), off: 0 };
}
/** Rentang diagonal (inci) dari rentang jarak (m). */
function diagonal(jarak, trW, trT, b, native) {
  if (!jarak) return [0, 0];
  const lpi = lebarPerInci(RASIO[native]);
  return [Math.round((angka(jarak.min) + b) / trT / lpi), Math.round((angka(jarak.max) + b) / trW / lpi)];
}

const hasil = [];
for (const p of projectorModels) {
  const [aw, ah] = String(p.AspectRatio ?? '').split('/').map(Number);
  const native = Object.keys(RASIO).find(k => RASIO[k][0] === aw && RASIO[k][1] === ah);
  if (!native) continue;
  const lensa = [];
  const tambah = (nama, trW, trT, jarak, offset, ust, jenis) => {
    if (!(trW > 0) || !(trT > 0)) return;
    const ket = `${trW}${trT !== trW ? ` - ${trT}` : ''}`;
    let b = 0, d = null;
    //  UST: "Distance" Vivitek bukan L = TR x lebar (diukur khusus) - rentang layar dari tabel TR-nya.
    if (ust) { const f = dariUst(ust, native); if (f) { trW = trT = f[0]; b = f[1]; const k = Object.keys(ust).map(Number); d = [Math.min(...k), Math.max(...k)]; } }
    const { pg, off } = shift(p['Lens Shift'], offset);
    lensa.push({
      n: nama, z: Math.abs(trT - trW) > 1e-6 ? 1 : 0, ar: koefisien(native, Math.min(trW, trT), Math.max(trW, trT), b), pg, off,
      ...(ust || /ultra short/i.test(jenis ?? '') ? { k: 1 } : {}), d: d ?? diagonal(jarak, Math.min(trW, trT), Math.max(trW, trT), b, native), ket,
    });
  };
  if (p['Throw Ratio']) {
    tambah('Lensa bawaan', angka(p['Throw Ratio'].min), angka(p['Throw Ratio'].max), p.Distance, p.Offset, p.ustTR, p.isUST ? 'Ultra Short Throw' : '');
  }
  for (const id of p['Optional Lens'] ?? []) {
    const l = lensaOpsi.get(id);
    if (!l) continue;
    const ust = /ultra short/i.test(l['Lens Type'] ?? '') && p.ustTR ? p.ustTR : null;
    //  Offset lensa (bila ada) menggantikan offset model; lens shift tetap kotak model.
    tambah(`${id.split('%%')[0]} (${l['Lens Type']})`, angka(l['Throw Ratio']?.min), angka(l['Throw Ratio']?.max), l.Distance,
      l.Offset ?? p.Offset, ust, l['Lens Type']);
  }
  if (!lensa.length) continue;
  const res = p.Resolution?.Desc === '4K' && native === '16:10' ? '4KP' : RESOLUSI[p.Resolution?.Desc] ?? null;
  const kontras = angka(String(p['Contrast Ratio'] ?? '').split(':')[0]);
  hasil.push({
    n: p.ModelName, kat: katModel.get(p.ModelName) ?? 0, a: native, r: res, lm: angka(p.Brightness?.value),
    ...(kontras > 1 ? { c: kontras } : {}), as: Object.keys(RASIO), l: lensa,
  });
}
hasil.sort((x, y) => x.n.localeCompare(y.n));
const keluar = path.join(akar, 'lib', 'data', 'vivitek-tdc.json');
fs.writeFileSync(keluar, JSON.stringify({ versi, sumber: 'Vivitek Projection Simulator', merek: 'Vivitek', kategori: KATEGORI, model: hasil }));
console.log(`${lokal ? `arsip ${arsip}` : `situs Vivitek -> arsip ${arsip}`}: ${hasil.length} model, ${hasil.reduce((a, h) => a + h.l.length, 0)} lensa -> ${keluar} (${(fs.statSync(keluar).size / 1024).toFixed(0)} KB)`);
