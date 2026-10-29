/**
 * uji/desain3d-susun-blending.ts - Susun edge blending di Desain 3D (inti/susunBlending.ts) dibandingkan dengan
 * kalkulator Panasonic & Kalkulator AV › Edge blending:
 *  - jarak lensa ke layar = rumus lensa Panasonic (L = TR x W - b) dengan TR di DALAM rentang zoom lensa;
 *  - tiap proyektor lurus (tilt 0, tanpa keystone), lens shift di dalam daerah lensa (segi delapan Panasonic);
 *  - overlap yang TERUKUR dari sinar 3D (inti/blending.ts) = overlap yang direncanakan (% , cm, px);
 *  - layar tertutup penuh; ruang kurang dalam & badan bertabrakan dilaporkan.
 *
 * Jalankan: npx tsx uji/desain3d-susun-blending.ts
 */
import { readFileSync } from 'fs';
import type { EntriPustaka } from '../lib/pustaka';
import {
  arahSinar, batasShift, bendaBaru, cakupanProyektor, daftarRuang, hitungBlending, isiDariPustaka, jarakUntukLebar, lensaDari,
  permukaanBenda, pikselBlending, susunBlending, zoomLensa, type Benda, type Lensa, type Ruang, type Titik,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}

const sql = readFileSync('supabase/migrations/057_pustaka_proyektor_panasonic.sql', 'utf8');
const entri: EntriPustaka[] = [...sql.matchAll(/\('proyektor', '((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)]
  .map((m, i) => ({ id: `e${i}`, jenis: 'proyektor', nama: m[1].replace(/''/g, "'"), data: JSON.parse(m[2].replace(/''/g, "'")) }));
const pustaka = (cari: string) => entri.find(e => e.nama.includes(cari))!;

const ruang: Ruang = { p: 14, l: 14, t: 4.5, lantai: 'polos', r2: null };
const K = daftarRuang(ruang)[0];
const layar = (w: number, h: number): Benda => ({ ...bendaBaru('layar', K), x: 7, z: 0.05, elev: 0.6, rot: 0, w, h, d: 0.04 });
const model = (cari: string): Benda => {
  const b = { ...bendaBaru('proyektor', K, { pasangProyektor: 'plafon' }), x: 7, z: 9, rot: 180 } as Benda;
  return { ...b, ...isiDariPustaka(b, pustaka(cari)) } as Benda;
};

/** Titik sinar (u, v) di bidang muka layar (z tetap). */
const keLayar = (L: Lensa, zMuka: number, u: number, v: number): Titik | null => {
  const d = arahSinar(L, u, v);
  if (d[2] >= 0) return null;
  const t = (zMuka - L.O[2]) / d[2];
  return [L.O[0] + d[0] * t, L.O[1] + d[1] * t, zMuka];
};
const N = 161;
const sampel = (p: Benda, zMuka: number) => {
  const L = lensaDari(p);
  const g = (sumbu: 'baris' | 'kolom') => Array.from({ length: N }, (_, i) => { const s = i / (N - 1) - 0.5; return sumbu === 'baris' ? keLayar(L, zMuka, s, 0) : keLayar(L, zMuka, 0, s); });
  return { p, L, baris: g('baris'), kolom: g('kolom') };
};

function periksa(judul: string, cari: string, w: number, h: number, kolom: number, baris: number, overlap: number) {
  console.log(`\n${judul}`);
  const l = layar(w, h), contoh = model(cari);
  const hs = susunBlending(contoh, [l, contoh], l, K, ruang, { kolom, baris, overlapPersen: overlap });
  const p = hs.ids.map(id => hs.benda.find(b => b.id === id)!);
  const r = hs.rencana;
  cek(`${kolom * baris} proyektor tersusun, satu model (contoh dipakai, sisanya salinan)`, p.length === kolom * baris && p[0].id === contoh.id && p.every(q => q.trMin === contoh.trMin && q.koreksiJarak === contoh.koreksiJarak));
  cek('tanpa peringatan (ruang cukup, shift cukup, badan tidak bertabrakan)', hs.peringatan.length === 0, hs.peringatan.join(' | '));
  cek('semua lurus: tilt 0 (tanpa keystone)', p.every(q => Math.abs(q.tilt ?? 0) < 0.05), p.map(q => q.tilt).join(', '));
  cek('lens shift di dalam daerah lensa (segi delapan Panasonic)', p.every(q => { const s = batasShift(q); return !s.lewatV && !s.lewatH && !s.lewatGabungan; }));
  const [lo, hi] = zoomLensa(contoh);
  cek(`TR di dalam rentang zoom ${lo.toFixed(3)}-${hi.toFixed(3)}`, p.every(q => (q.throwRatio ?? 0) >= lo - 1e-6 && (q.throwRatio ?? 0) <= hi + 1e-6));
  //  Jarak ujung lensa ke bidang layar = rumus lensa Panasonic untuk gambar selebar ubin pada zoom itu.
  const zMuka = l.z + l.d / 2;
  const [jMin, jMax] = jarakUntukLebar(contoh, r.lebarSatuM);
  //  Lebar gambar nyata di layar (dari sinar 3D) = lebar ubin rencana.
  const lebarNyata = p.map(q => { const L = lensaDari(q); return keLayar(L, zMuka, 0.5, 0)![0] - keLayar(L, zMuka, -0.5, 0)![0]; });
  cek(`lebar gambar tiap proyektor di layar = ${r.lebarSatuM.toFixed(3)} m (selisih < 1 cm)`, lebarNyata.every(x => Math.abs(Math.abs(x) - r.lebarSatuM) < 0.01), lebarNyata.map(x => Math.abs(x).toFixed(3)).join(', '));
  cek(`jarak lempar dalam rentang lensa Panasonic ${jMin.toFixed(3)}-${jMax.toFixed(3)} m`, p.every(q => {
    const tip = lensaDari({ ...q, koreksiJarak: 0, koreksiJarakTele: undefined }).O;
    const d = Math.abs(tip[2] - zMuka);
    return d >= jMin - 0.012 && d <= jMax + 0.012;
  }));
  //  Overlap terukur dari sinar 3D = rencana.
  const s = p.map(q => sampel(q, zMuka));
  const bl = hitungBlending(s);
  if (kolom > 1) {
    const h1 = bl.find(b => b.a === p[0].id && b.b === p[1].id && b.arah === 'kiri-kanan');
    cek(`overlap kiri-kanan terukur ${h1 ? h1.persenA.toFixed(2) : '-'}% = rencana ${r.overlapHPersen.toFixed(2)}%`, !!h1 && Math.abs(h1.persenA - r.overlapHPersen) < 0.4 && Math.abs(h1.persenB - r.overlapHPersen) < 0.4);
    cek(`lebar area blending ${h1 ? (h1.lebarM * 100).toFixed(1) : '-'} cm = rencana ${(r.overlapHM * 100).toFixed(1)} cm (± 1 cm)`, !!h1 && Math.abs(h1.lebarM - r.overlapHM) < 0.01);
    cek(`piksel blending ${h1 ? pikselBlending(h1.persenA, 'kiri-kanan', h1.pxA) : '-'} px = rencana ${r.overlapHpx} px (± 3)`, !!h1 && Math.abs(pikselBlending(h1.persenA, 'kiri-kanan', h1.pxA) - r.overlapHpx) <= 3);
  }
  if (baris > 1) {
    const v1 = bl.find(b => b.a === p[0].id && b.b === p[kolom].id && b.arah === 'atas-bawah');
    cek(`overlap atas-bawah terukur ${v1 ? v1.persenA.toFixed(2) : '-'}% = rencana ${r.overlapVPersen.toFixed(2)}%`, !!v1 && Math.abs(v1.persenA - r.overlapVPersen) < 0.4);
  }
  const c = cakupanProyektor(p, permukaanBenda(l));
  cek(`layar ${w} × ${h} m tertutup ${(c.tertutup * 100).toFixed(1)}%`, c.tertutup >= 0.995);
  return { hs, p };
}

periksa('1. PT-MZ882 + ET-ELS20, layar 8 × 2,5 m, 3 × 1, overlap 15%', 'ELS20', 8, 2.5, 3, 1, 15);
periksa('2. PT-MZ882 + ET-ELW20, layar 6 × 3,5 m, 2 × 2, overlap 20%', 'ELW20', 6, 3.5, 2, 2, 20);

console.log('\n3. Resolusi panel dari Pustaka ikut ke piksel blending');
{
  const l = layar(8, 2.5), contoh = model('ELS20');
  cek('PT-MZ882 dari Pustaka = WUXGA 16:10', contoh.resolusiProyektor === 'WUXGA' && contoh.rasioProyektor === '16:10');
  const lmx = model('LMX460');
  cek('PT-LMX460 dari Pustaka = XGA 4:3', lmx.resolusiProyektor === 'XGA' && lmx.rasioProyektor === '4:3');
  const hs = susunBlending({ ...contoh, resolusiProyektor: '4K', rasioProyektor: '16:9' }, [l], l, K, ruang, { kolom: 2, baris: 1, overlapPersen: 15 });
  const zMuka = l.z + l.d / 2;
  const p = hs.ids.map(id => hs.benda.find(b => b.id === id)!);
  const bl = hitungBlending(p.map(q => sampel(q, zMuka)))[0];
  cek(`4K: 15% overlap = ${hs.rencana.overlapHpx} px dari 3840 (bukan 288 dari acuan 1920)`, hs.rencana.overlapHpx === 576 && bl?.pxA === 3840 && bl.resA === '4K');
}

console.log('\n4. Batas nyata dilaporkan');
{
  const sempit: Ruang = { p: 14, l: 5, t: 4.5, lantai: 'polos', r2: null };
  const Ks = daftarRuang(sempit)[0];
  const l = { ...layar(8, 2.5) };
  const contoh = { ...model('ELT22'), z: 4 };
  const hs = susunBlending(contoh, [l, contoh], l, Ks, sempit, { kolom: 3, baris: 1, overlapPersen: 15 });
  cek('lensa tele di ruang 5 m: "Ruang kurang dalam" dilaporkan', hs.peringatan.some(t => t.startsWith('Ruang kurang dalam')), hs.peringatan.join(' | '));
  const kecil = susunBlending(model('ELS20'), [layar(1.2, 0.25)], layar(1.2, 0.25), K, ruang, { kolom: 3, baris: 1, overlapPersen: 15 });
  cek('layar 1,2 × 0,25 m (gambar 0,44 m, jarak lensa 0,38 m): badan bertabrakan dilaporkan', kecil.peringatan.some(t => t.startsWith('Badan proyektor bertabrakan')), kecil.peringatan.join(' | '));
}

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
