/**
 * scripts/impor-panasonic-tdc.mjs - Buat katalog proyektor Panasonic (lib/data/panasonic-tdc.json) dari data
 * Panasonic Throw Distance Calculator resmi (https://docs.connect.panasonic.com/projector/calculator/tdc/).
 *
 * Jalankan: node scripts/impor-panasonic-tdc.mjs <folder berisi ModelData.js & ModelDataDef.js> [versi]
 *
 * Berkas Panasonic hanya DIBACA sebagai teks (literal objek JS diurai ke JSON), tidak pernah dijalankan.
 *
 * Yang diambil per lensa: koefisien rumus jarak L = A x diagonal(inci) + B di ujung wide & tele untuk SETIAP rasio
 * sinyal yang didukung model itu (persis yang dipakai hasil kalkulator Panasonic), dikonversi ke bentuk Desain 3D:
 *   TR = A / 0,0254 x diagonal/lebar gambar,  b = -B   ->  L = TR x lebar gambar - b
 * plus rasio native panel (AspectRatio[0], dasar lumen efektif), poligon daerah lens shift (LensShiftVp), offset
 * tetap lensa tanpa shift & rentang ukuran layar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [folder, versi = '2.79'] = process.argv.slice(2);
if (!folder) { console.error('Pakai: node scripts/impor-panasonic-tdc.mjs <folder TDC> [versi]'); process.exit(1); }
const teks = fs.readFileSync(path.join(folder, 'ModelData.js'), 'utf8');
const def = fs.readFileSync(path.join(folder, 'ModelDataDef.js'), 'utf8');
const BS = String.fromCharCode(92), QT = '"', SQ = "'";

/** Potong literal { ... } / [ ... ] mulai indeks i (memperhatikan string). */
function ambilLiteral(s, i) {
  let d = 0, str = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (str) { if (c === BS) { j++; continue; } if (c === str) str = null; continue; }
    if (c === QT || c === SQ) { str = c; continue; }
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (d === 0) return s.slice(i, j + 1); }
  }
  throw new Error('literal tidak tertutup');
}
/** Literal objek JS (kunci tanpa kutip, string ' / ") -> nilai JSON. */
function keJson(t) {
  let o = '';
  for (let j = 0; j < t.length; j++) {
    const c = t[j];
    if (c === QT || c === SQ) {
      let k = j + 1, isi = '';
      for (; k < t.length && t[k] !== c; k++) { if (t[k] === BS) { isi += t[k] + t[k + 1]; k++; } else isi += t[k]; }
      o += JSON.stringify(JSON.parse(QT + isi.split(BS + SQ).join(SQ).replace(/(^|[^\\])"/g, '$1\\"') + QT)); j = k; continue;
    }
    if (/[A-Za-z_$]/.test(c) && /[{,]\s*$/.test(o)) {
      let k = j; while (k < t.length && /[\w$]/.test(t[k])) k++;
      if (t[k] === ':') { o += QT + t.slice(j, k) + QT; j = k - 1; continue; }
    }
    o += c;
  }
  return JSON.parse(o);
}

//  Nama model -> id data ("PT-VMZ51":vmz51) & kategori (7 = Previous / sudah tidak diproduksi).
//  Tabel bahasa Inggris saja (_modelDataTblEn); tabel Jepang memberi nama berakhiran J untuk data yang sama.
const tblEn = def.slice(def.indexOf('_modelDataTblEn='), def.indexOf('_modelDataTblJa='));
const idKeNama = new Map([...tblEn.matchAll(/"(PT-[^"]+)":(\w+)/g)].map(m => [m[2], m[1]]));
const kategori = new Map([...def.matchAll(/ProjectorModelName:"([^"]+)",ProjectorCategoryValue:(\d+)/g)].map(m => [m[1], Number(m[2])]));

const model = [];
for (const m of teks.matchAll(/(\w+)=function\(\)\{return function\(\)\{this\.projectorTecnicalData=/g)) {
  const i = m.index + m[0].length;
  const tekStr = ambilLiteral(teks, i);
  const k = teks.indexOf('this.lensData=', i + tekStr.length);
  model.push({ id: m[1], tek: keJson(tekStr), lensa: keJson(ambilLiteral(teks, k + 'this.lensData='.length)) });
}

const RASIO = { '16:10': [16, 10], '16:9': [16, 9], '4:3': [4, 3], '17:9': [17, 9], '21:9': [64, 27] };
/** "16:10(WUXGA)" -> '16:10'; 2.35:1 tidak didukung Desain 3D -> null. */
const rasioDari = (nama) => { const r = (nama.match(/^(\d+:\d+)/) ?? [])[1]; return r && RASIO[r] ? r : null; };
/** Resolusi panel native (kunci ResolusiProyektor Desain 3D). */
function resolusiDari(nama) {
  const n = nama.replace(/\s+/g, '');
  if (n.startsWith('17:9')) return '4KDCI';
  if (n.startsWith('16:10(WUXGA')) return 'WUXGA';
  if (n.startsWith('16:10(WXGA')) return 'WXGA';
  if (n.startsWith('16:10(WQXGA')) return 'WQXGA';
  if (n.startsWith('16:10(4K')) return '4KP';
  if (n.startsWith('16:9(Full-HD')) return 'FHD';
  if (n.startsWith('16:9(4K') || n.startsWith('16:9(UltraHD')) return '4K';
  if (n.startsWith('16:9(WXGA')) return 'WXGAH';
  if (n.startsWith('4:3(XGA)')) return 'XGA';
  if (n.startsWith('4:3(SXGA+')) return 'SXGAP';
  return null;
}
const angka = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const bulat = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
/** B Panasonic (m) dengan tanda: "minus" = dikurangkan. */
const nilaiB = (v, tanda) => (tanda === 'minus' ? -angka(v) : angka(v));

const hasil = [];
for (const m of model) {
  const nama = idKeNama.get(m.id);
  if (!nama) continue;
  const tk = m.tek, asp = tk.AspectRatio ?? [];
  const native = rasioDari(asp[0]?.AspectRatioName ?? '');
  if (!native) continue;
  const [lmBiasa, lmPusat] = String(tk.Brightness ?? '').replace(/\s+/g, '').split('/').map(angka);
  const kontras = angka(String(tk.ContrastRatio ?? '').replace(/\s+/g, '').split(':')[0].replace(/,/g, ''));
  const aspek = [...new Set(asp.map(a => rasioDari(a.AspectRatioName)).filter(Boolean))];
  const lensa = [];
  for (const l of m.lensa) {
    const tetap = l.LensType === 'Fixed-focus lens';
    //  Koefisien PER RASIO sinyal - persis yang dipakai hasil kalkulator Panasonic (Y()): rumus native + potong rasio
    //  bisa selisih puluhan mm di 125 model (data per rasio Panasonic tidak selalu turunan rasio native-nya).
    //  TR relatif LEBAR GAMBAR rasio itu: L = TR x lebar gambar - b.
    const ar = {};
    asp.forEach((nm, ai) => {
      const ra = rasioDari(nm.AspectRatioName), c = l.AspectRatio?.[ai];
      if (!ra || !c || ar[ra]) return;
      const Aw = angka(tetap ? c.FixCaluclateValue1 : c.MinCaluclateValue1), At = angka(tetap ? c.FixCaluclateValue1 : c.MaxCaluclateValue1);
      if (!(Aw > 0) || !(At > 0)) return;
      const Bw = tetap ? nilaiB(c.FixCaluclateValue2, c.FixCaluclateValue3) : nilaiB(c.MinCaluclateValue2, c.MinCaluclateValue3);
      const Bt = tetap ? nilaiB(c.FixCaluclateValue2, c.FixCaluclateValue3) : nilaiB(c.MaxCaluclateValue2, c.MaxCaluclateValue3);
      const [uw, uh] = RASIO[ra], diagPerLebar = Math.hypot(uw, uh) / uw;
      const w = [bulat((Aw / 0.0254) * diagPerLebar), bulat(-Bw)], t = [bulat((At / 0.0254) * diagPerLebar), bulat(-Bt)];
      //  Beberapa data Panasonic menukar ujung zoom (PT-DZ12000 + ET-D75LE10 16:10: TR "wide" 1,319 > "tele" 1,120) -
      //  diurutkan TR kecil -> besar dengan b PASANGANNYA, supaya L tiap ujung tetap sama dengan kalkulator Panasonic.
      const [lo, hi] = w[0] <= t[0] ? [w, t] : [t, w];
      ar[ra] = [lo[0], hi[0], lo[1], hi[1]];
    });
    if (!ar[native]) continue;
    const a0 = l.AspectRatio[0];
    const nPg = angka(l.Polygon);
    const pg = nPg > 0 && Array.isArray(l.LensShiftVp) ? l.LensShiftVp.slice(0, nPg).flatMap(t => [bulat(angka(t.x), 4), bulat(angka(t.y), 4)]) : null;
    const dMin = angka(tetap ? a0.FixMinScreenSize : a0.MinMinScreenSize), dMaks = angka(tetap ? a0.FixMaxScreenSize : a0.MaxMaxScreenSize);
    //  Lensa yang jaraknya TIDAK diukur dari muka lensa biasa (ultra short throw cermin, lensa L, proyeksi belakang):
    //  kalkulator Panasonic memakai gambar & rumus L1/L2/H khusus - ditandai supaya tidak dianggap sama persis.
    const khusus = (l.ProjectionDistanceImage ?? '') !== 'ill_pjfig_1_en.png' || ['ET-C1U200', 'ET-D75LE95'].includes(l.LensName);
    lensa.push({
      n: l.LensName, z: tetap ? 0 : 1, ar, pg, off: bulat(angka(l.LensShiftOffsetV), 4),
      ...(khusus ? { k: 1 } : {}), d: [dMin, dMaks], ket: String(l.ThrowRatio ?? '').replace(/<br>/g, ' · ').slice(0, 200),
    });
  }
  if (!lensa.length) continue;
  hasil.push({
    n: nama, kat: kategori.get(nama) ?? 0, a: native, r: resolusiDari(asp[0].AspectRatioName), lm: lmBiasa || 0,
    ...(lmPusat ? { lmc: lmPusat } : {}), ...(kontras > 1 ? { c: kontras } : {}), as: aspek, l: lensa,
  });
}
hasil.sort((x, y) => (x.kat === 7) - (y.kat === 7) || x.n.localeCompare(y.n));
const keluar = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'data', 'panasonic-tdc.json');
fs.mkdirSync(path.dirname(keluar), { recursive: true });
fs.writeFileSync(keluar, JSON.stringify({ versi, sumber: 'Panasonic Throw Distance Calculator', model: hasil }));
console.log(`${hasil.length} model, ${hasil.reduce((a, h) => a + h.l.length, 0)} lensa -> ${keluar} (${(fs.statSync(keluar).size / 1024).toFixed(0)} KB)`);
