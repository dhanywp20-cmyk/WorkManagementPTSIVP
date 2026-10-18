/**
 * uji/desain3d-ukuran.ts - Ukuran & perhitungan Desain 3D yang dulu meleset:
 *  1. tinggi ruangan (plafon) tampil di kanvas 3D & denah;
 *  2. ubah tinggi plafon / salin ke ruang lain tidak merusak arah proyektor ke layar;
 *  3. gambar proyektor selalu 16:9 (layar 4:3 / 16:10 / 21:9 tetap tertutup, angka lux benar);
 *  4. aturan jarak pandang 4-6-8 memakai tinggi GAMBAR, bukan bodi TV / IFP;
 *  5. benda yang diturunkan karena plafon lebih rendah tidak menembus plafon.
 *
 * Jalankan: npm test -- desain3d-ukuran
 */
import { readFileSync } from 'fs';
import {
  bendaBaru, cakupanProyektor, daftarRuang, denahDari, KATEGORI_RUANG, permukaanBenda, proyektorKeLayar, salinIsi,
  sesuaikanUkuranRuang, sinarProyektor, templateRuang, throwRatioDari, ukuranGambarDisplay, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { ukuranDariDiagonal } from '../lib/av-hitung';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ` - ${ket}` : ''}`); } };
const pr = (n: number) => `${Math.round(n * 1000) / 10}%`;
const D3 = 'app/(portal)/tools-team/_components/desain3d';

const r3: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
const k3 = daftarRuang(r3)[0];

console.log('\n1. Tinggi ruangan tampil');
{
  const alat = readFileSync(`${D3}/mesin/alatBantu.ts`, 'utf8');
  cek('kanvas 3D (Ukuran): garis tegak lantai-plafon + label "plafon N m" tiap ruang', /label\(`plafon \$\{f\(k\.t\)\} m`/.test(alat) && /new THREE\.Vector3\(xt, k\.t, zt\)/.test(alat));
  const rr: Ruang = { ...r3, r2: { aktif: true, p: 6, l: 6, t: 4.2, sekat: 'tembok' } as Ruang['r2'] };
  const tulisan = denahDari(rr, []).tulisan.map(t => t.teks);
  cek('denah 2D: "PLAFON +3.000" & "PLAFON +4.200" (tiap ruang)', tulisan.includes('PLAFON +3.000') && tulisan.includes('PLAFON +4.200'), tulisan.filter(t => /PLAFON/.test(t)).join(', '));
}

console.log('\n2. Ubah tinggi plafon: proyektor tetap mengenai layar');
const tutup = (bs: Benda[]) => {
  const p = bs.find(b => b.jenis === 'proyektor')!, l = bs.find(b => b.jenis === 'layar')!;
  return { c: cakupanProyektor([p], permukaanBenda(l)), p };
};
{
  const layar = bendaBaru('layar', k3, { diag: 100 });
  const p = proyektorKeLayar(bendaBaru('proyektor', k3, { pasangProyektor: 'plafon' }), layar, k3, r3);
  for (const t of [4.5, 6, 2.6, 2.4]) {
    const r = { ...r3, t };
    const { c, p: q } = tutup(sesuaikanUkuranRuang([layar, p], r3, r));
    cek(`plafon 3 -> ${t} m: tinggi proyektor tetap (drop pole menyesuaikan), tertutup ${pr(c.tertutup)}, meleset ${pr(c.meleset[0])}`,
      q.elev === p.elev && c.tertutup >= 0.99 && c.meleset[0] <= 0.02, `elev ${q.elev}`);
  }
  for (const t of [2.25, 2.2]) {
    const r = { ...r3, t };
    const { c, p: q } = tutup(sesuaikanUkuranRuang([layar, p], r3, r));
    cek(`plafon ${t} m (proyektor tidak muat): dipasang ulang di bawah plafon, tetap tertutup ${pr(c.tertutup)}`,
      q.elev + q.h <= t - 0.05 && c.tertutup >= 0.99 && c.meleset[0] <= 0.02, `puncak ${q.elev + q.h}`);
  }
  const rr: Ruang = { ...r3, r2: { aktif: true, p: 8, l: 6, t: 4, sekat: 'tembok' } as Ruang['r2'] };
  const ks = daftarRuang(rr);
  const { c } = tutup(salinIsi([layar, p], rr, ks[0], ks[1]));
  cek(`salin ke ruang 2 berplafon 4 m: tetap tertutup ${pr(c.tertutup)}`, c.tertutup >= 0.99 && c.meleset[0] <= 0.02);
}

console.log('\n3. Gambar proyektor 16:9 di semua rasio layar');
{
  const r: Ruang = { p: 8, l: 8, t: 3.2, lantai: 'kayu', r2: null };
  const k = daftarRuang(r)[0];
  for (const rasio of ['16:9', '4:3', '16:10', '21:9']) {
    const l = bendaBaru('layar', k, { diag: 100, rasio } as Partial<Benda>);
    const p = proyektorKeLayar(bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), l, k, r);
    const sn = sinarProyektor(p, [l, p], r);
    const c = cakupanProyektor([p], permukaanBenda(l));
    cek(`layar ${rasio}: ukuran gambar = jarak / TR x 9/16, layar tertutup ${pr(c.tertutup)}, tanpa tilt`,
      Math.abs(sn.lebar - sn.jarak / throwRatioDari(p)) < 1e-9 && Math.abs(sn.tinggi - (sn.lebar * 9) / 16) < 1e-9 && c.tertutup >= 0.99 && (p.tilt ?? 0) === 0,
      `${sn.lebar.toFixed(2)} x ${sn.tinggi.toFixed(2)}, tilt ${p.tilt}`);
  }
}

console.log('\n4. Jarak pandang 4-6-8 memakai tinggi gambar');
{
  const u65 = ukuranDariDiagonal(65), u86 = ukuranDariDiagonal(86);
  const tv = bendaBaru('tv', k3, { diag: 65 }), ifp = bendaBaru('ifp', k3, { diag: 86 });
  cek(`TV 65": gambar ${ukuranGambarDisplay(tv).h} m (bodi ${tv.h} m)`, Math.abs(ukuranGambarDisplay(tv).h - u65.tinggiM) < 0.001 && tv.h > ukuranGambarDisplay(tv).h);
  cek(`IFP 86": gambar ${ukuranGambarDisplay(ifp).h} m (bodi ${ifp.h} m)`, Math.abs(ukuranGambarDisplay(ifp).h - u86.tinggiM) < 0.001 && ifp.h > ukuranGambarDisplay(ifp).h);
  const layar = bendaBaru('layar', k3, { diag: 120 });
  cek('layar proyektor & videowall: seluruh permukaan', ukuranGambarDisplay(layar).h === layar.h);
  //  Kelas 6,79 m: aturan 6x perlu 1,13 m - IFP 86" (gambar 1,07 m) KURANG, padahal bodinya 1,17 m (dulu "cukup").
  const perlu = 6.79 / 6;
  cek('IFP 86" di penonton 6,79 m (aturan 6x, perlu 1,13 m): kurang, bukan "cukup" dari tinggi bodi', ukuranGambarDisplay(ifp).h < perlu && ifp.h >= perlu);
  const keadaan = readFileSync(`${D3}/useKeadaanDesain.ts`, 'utf8');
  cek('analisis tampilan membandingkan tinggi gambar', /cukup: gambar\.h >= tinggiPerlu/.test(keadaan) && !/cukup: d\.h >= tinggiPerlu/.test(keadaan));
  cek('kartu analisis & lembar cetak menulis ukuran gambar', /a\.gambar\.h/.test(readFileSync(`${D3}/panel/KartuAnalisis.tsx`, 'utf8')) && /a\.gambar\.w/.test(readFileSync(`${D3}/ekspor/useEkspor.ts`, 'utf8')));
}

console.log('\n5. Benda di bawah plafon yang diturunkan');
{
  const tv = { ...bendaBaru('tv', k3, { diag: 86 }), elev: 1.4 };
  const sp = bendaBaru('speaker', k3, {});
  for (const t of [2.2, 2.0]) {
    const hasil = sesuaikanUkuranRuang([tv, sp], r3, { ...r3, t });
    cek(`plafon ${t} m: TV 86" & speaker dinding tidak menembus plafon`, hasil.every(b => b.elev + b.h <= t + 1e-9), hasil.map(b => (b.elev + b.h).toFixed(4)).join(' / '));
  }
}

console.log('\n6. Template semua kategori di dalam ruang');
for (const kat of KATEGORI_RUANG) {
  const t = templateRuang(kat.id), ks = daftarRuang(t.ruang);
  const keluar = t.benda.filter(b => b.jenis !== 'teks').filter(b => {
    const k = ks.find(x => b.x >= x.x0 - 1e-6 && b.x <= x.x0 + x.p + 1e-6) ?? ks[0];
    return b.elev < -0.01 || b.elev + b.h > k.t + 0.01;
  });
  cek(`${kat.id}: tidak ada benda menembus lantai / plafon (${ks.map(k => `${k.t} m`).join(' + ')})`, keluar.length === 0, keluar.map(b => b.nama).join(', '));
}

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
