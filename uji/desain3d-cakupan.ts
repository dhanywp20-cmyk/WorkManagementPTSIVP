/**
 * uji/desain3d-cakupan.ts - Cakupan sinar proyektor (inti/cakupanProyektor.ts) dengan sinar sebenarnya dari
 * lensa: semua template kategori yang memakai proyektor menutup permukaan sasarannya, dan "Tambah proyektor"
 * ke layar (proyektorKeLayar) memasang proyektor lurus tanpa keystone dengan gambar pas di layar.
 *
 * Jalankan: npm test -- desain3d-cakupan
 */
import { readFileSync } from 'fs';
import {
  bendaBaru, cakupanProyektor, daftarRuang, KATEGORI_RUANG, permukaanBenda, permukaanPersegi, permukaanRuang, proyektorKeLayar,
  templateRuang, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ` - ${ket}` : ''}`); } };
const pr = (n: number) => `${Math.round(n * 1000) / 10}%`;
const proyektorDi = (b: Benda[]) => b.filter(x => x.jenis === 'proyektor');

console.log('\n1. Alat ukur');
{
  const k = { x0: 0, p: 8, l: 6, t: 3 };
  const layar = bendaBaru('layar', k, { diag: 120 });
  const menjauh = { ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), rot: 0 };
  const c = cakupanProyektor([menjauh], permukaanBenda(layar));
  cek('proyektor membelakangi layar: 0% tertutup, 100% meleset', c.tertutup === 0 && c.meleset[0] === 1);
  const dinding = permukaanRuang(k, 'depan');
  cek('dinding depan: titik sampel di z = 0, normal ke dalam ruang', dinding.kena([4, 1.5, 3], [0, 0, -1]) !== null && dinding.kena([4, 1.5, 3], [0, 0, 1]) === null);
}

console.log('\n2. Template kategori');
const kategoriProyektor = KATEGORI_RUANG.filter(k => proyektorDi(templateRuang(k.id).benda).length);
cek('template yang memakai proyektor: mapping cekung, cembung, objek, immersive',
  kategoriProyektor.map(k => k.id).sort().join() === ['immersive', 'mapping-cembung', 'mapping-lengkung', 'mapping-objek'].join());
for (const id of ['mapping-lengkung', 'mapping-cembung'] as const) {
  const t = templateRuang(id), proj = proyektorDi(t.benda), bidang = t.benda.find(b => b.jenis === 'bidang')!;
  const c = cakupanProyektor(proj, permukaanBenda(bidang));
  cek(`${id}: layar tertutup >= 99% (${pr(c.tertutup)})`, c.tertutup >= 0.99, c.celah.join('/'));
  cek(`${id}: ada area blending 10-40% (${pr(c.tumpang)})`, c.tumpang >= 0.1 && c.tumpang <= 0.4);
  cek(`${id}: zoom yang dipakai ada di rentang lensanya`, proj.every(p => (p.throwRatio ?? 0) >= (p.trMin ?? 0) - 1e-9 && (p.throwRatio ?? 0) <= (p.trMax ?? 9) + 1e-9));
}
{
  const t = templateRuang('mapping-objek'), proj = proyektorDi(t.benda);
  //  Objek pengganti: kotak 1,2 x 1,6 x 1,2 m di atas alas 0,4 m (objek impor umumnya seukuran ini).
  const [cx, cz, y0, w, h] = [6, 5, 0.4, 1.2, 1.6];
  const sisi = [
    permukaanPersegi('sisi depan', [cx, y0 + h / 2, cz + w / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], w, h),
    permukaanPersegi('sisi belakang', [cx, y0 + h / 2, cz - w / 2], [-1, 0, 0], [0, 1, 0], [0, 0, -1], w, h),
    permukaanPersegi('sisi kanan', [cx + w / 2, y0 + h / 2, cz], [0, 0, -1], [0, 1, 0], [1, 0, 0], w, h),
    permukaanPersegi('sisi kiri', [cx - w / 2, y0 + h / 2, cz], [0, 0, 1], [0, 1, 0], [-1, 0, 0], w, h),
  ];
  const cs = sisi.map(s => cakupanProyektor(proj, s));
  cek(`mapping-objek: keempat sisi objek tersinari sampai bawah (${cs.map(c => pr(c.tertutup)).join(' / ')})`, cs.every(c => c.tertutup >= 0.99));
  const atas = cakupanProyektor(proj, permukaanPersegi('atas', [cx, y0 + h, cz], [1, 0, 0], [0, 0, -1], [0, 1, 0], w, w));
  cek('mapping-objek: puncak objek tersinari', atas.tertutup >= 0.99);
}
{
  const t = templateRuang('immersive'), proj = proyektorDi(t.benda), k = daftarRuang(t.ruang)[0];
  for (const s of ['depan', 'belakang', 'kiri', 'kanan', 'lantai'] as const) {
    const c = cakupanProyektor(proj, permukaanRuang(k, s));
    cek(`immersive: ${s} tertutup dari lantai sampai plafon (${pr(c.tertutup)})`, c.tertutup >= 0.99, c.celah.join('/'));
  }
  const lantai = cakupanProyektor(proj, permukaanRuang(k, 'lantai'));
  cek('immersive: dua proyektor lantai punya area blending di tengah', lantai.tumpang > 0.05);
}

console.log('\n3. Tambah proyektor ke layar (proyektorKeLayar)');
const RUANG: [string, Ruang][] = [
  ['meeting 8 x 6 x 3', { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null }],
  ['kelas 10 x 8 x 3,2', { p: 10, l: 8, t: 3.2, lantai: 'keramik', r2: null }],
  ['aula 16 x 20 x 7', { p: 16, l: 20, t: 7, lantai: 'karpet', r2: null }],
];
for (const [nama, ruang] of RUANG) {
  const k = daftarRuang(ruang)[0];
  for (const diag of [100, 120, 150]) {
    const layar = bendaBaru('layar', k, { diag });
    const p = proyektorKeLayar(bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), layar, k, ruang);
    const c = cakupanProyektor([p], permukaanBenda(layar));
    cek(`${nama}, layar ${diag}": lurus, tertutup ${pr(c.tertutup)}, meleset ${pr(c.meleset[0])}`, (p.tilt ?? 0) === 0 && c.tertutup >= 0.99 && c.meleset[0] <= 0.02,
      `tilt ${p.tilt} elev ${p.elev}`);
  }
}
{
  //  Plafon tinggi (aula 7 m): dulu proyektor tetap di 6,5 m dan menunduk -60° (85% cahaya meleset).
  const ruang = RUANG[2][1], k = daftarRuang(ruang)[0];
  const layar = bendaBaru('layar', k, { diag: 100 });
  const p = proyektorKeLayar(bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), layar, k, ruang);
  cek('aula 7 m + layar 100": diturunkan (drop pole) ke tepi atas layar, bukan menunduk tajam', (p.tilt ?? 0) === 0 && p.elev < 3, `elev ${p.elev}`);
  //  Ruang pendek: zoom ke throw ratio yang masih muat (dalam rentang lensa 1,39-2,09).
  const r2: Ruang = { p: 8, l: 5, t: 3, lantai: 'kayu', r2: null };
  const k2 = daftarRuang(r2)[0];
  const l2 = bendaBaru('layar', k2, { diag: 130 });
  const p2 = proyektorKeLayar(bendaBaru('proyektor', k2, { pasangProyektor: 'plafon' }), l2, k2, r2);
  const c2 = cakupanProyektor([p2], permukaanBenda(l2));
  cek(`ruang 5 m + layar 130": zoom ke TR ${p2.throwRatio} (TR 1,6 tidak muat) & tetap pas (${pr(c2.tertutup)})`,
    (p2.throwRatio ?? 0) < 1.6 && (p2.throwRatio ?? 0) > 1.39 && c2.tertutup >= 0.99 && c2.meleset[0] <= 0.02);
  //  Tidak mungkin muat (150" perlu >= 1,39 x 3,32 = 4,6 m): zoom terlebar, gambar memang lebih kecil dari layar.
  const l3 = bendaBaru('layar', k2, { diag: 150 });
  const p4 = proyektorKeLayar(bendaBaru('proyektor', k2, { pasangProyektor: 'plafon' }), l3, k2, r2);
  const c4 = cakupanProyektor([p4], permukaanBenda(l3));
  cek(`ruang 5 m + layar 150" (tidak muat): zoom terlebar TR 1,39, gambar di dalam layar (${pr(c4.tertutup)}, meleset ${pr(c4.meleset[0])})`,
    p4.throwRatio === 1.39 && c4.tertutup < 0.99 && c4.meleset[0] <= 0.02);
  //  Layar di dinding kiri (rot 90): tetap lurus & pas.
  const kiri = { ...bendaBaru('layar', k2, { diag: 100 }), x: 0.05, z: 2.5, rot: 90 };
  const p3 = proyektorKeLayar(bendaBaru('proyektor', k2, { pasangProyektor: 'plafon' }), kiri, k2, r2);
  const c3 = cakupanProyektor([p3], permukaanBenda(kiri));
  cek(`layar dinding kiri: pas (${pr(c3.tertutup)}), menghadap layar`, c3.tertutup >= 0.99 && p3.rot === 270);
  //  Proyektor meja (portabel): tinggi meja tetap, gambar diangkat dengan offset/tilt - tetap mengenai layar.
  const pm = proyektorKeLayar(bendaBaru('proyektor', k, { pasangProyektor: 'meja' }), bendaBaru('layar', k, { diag: 100 }), k, ruang);
  cek('proyektor meja: tinggi meja tidak diubah', pm.elev === bendaBaru('proyektor', k, { pasangProyektor: 'meja' }).elev);
}

console.log('\n4. Tepi cahaya & Mask ke bidang');
{
  const sinar = readFileSync('app/(portal)/tools-team/_components/desain3d/mesin/sinar.ts', 'utf8');
  cek('sel di tepi layar / bidang (sudut di permukaan berbeda) dipecah halus, bukan dibuang (zigzag)',
    /const satuSel = \(q: \(Kena \| null\)\[\]\): q is Kena\[\] => q\.every\(x => !!x && x\.id === q\[0\]!\.id && sePermukaan\(q\[0\]!, x\)\)/.test(sinar)
    && /else tepiHalus\(s4,/.test(sinar));
  cek('tepi bayangan & tepi layar dicari dengan bagi dua sinar (tidak bertangga selebar sub-sel)', /if \(anggota\(h\)\) \{ lo = t; kenaLo = h; \} else hi = t;/.test(sinar));
  cek('pojok ruangan (lantai-dinding) bukan "satu permukaan": dibedakan per mesh & normal', /if \(a\.kunci === b\.kunci\) return d > 0\.7;/.test(sinar));
  cek('bidang gambar diangkat tegak lurus permukaan (tidak tenggelam di layar lengkung yang disinari miring)',
    /hit\.point\.clone\(\)\.addScaledVector\(n, ANGKAT\)/.test(sinar) && /melengkung\(q\)/.test(sinar));
  cek('cahaya hanya di sisi yang menghadap lensa: tidak tembus ke balik layar / melayang di dinding yang disembunyikan',
    /side: THREE\.FrontSide, blending: THREE\.AdditiveBlending/.test(sinar) && !/LineSegments/.test(sinar));
  cek('zona blending dipotong halus: bingkai lawan + sudut datang kedua lensa (COS_MIN)',
    /cos\(A\.O\) - COS_MIN, cos\(B\.O\) - COS_MIN/.test(readFileSync('app/(portal)/tools-team/_components/desain3d/mesin/blending.ts', 'utf8')));
  cek('Mask ke bidang: hanya cahaya di layar / bidang yang digambar', /const bolehId = \(id: string \| null\) => !diBenda\(id\) && \(!mask \|\| diBidang\(id\)\)/.test(sinar));
  cek('semua template: sinar nyata tanpa Mask (cahaya lewat tepi layar tetap jatuh ke dinding / lantai)',
    KATEGORI_RUANG.every(k => proyektorDi(templateRuang(k.id).benda).every(p => !p.maskBidang)));
  cek('terang cahaya per titik mengikuti jarak² & sudut datang (bukan warna rata di semua permukaan)',
    /return Math\.max\(0\.05, cosT\) \/ \(cosA \*\* 3 \* d2\);/.test(sinar) && /vertexColors: true, opacity: bg\.opasitas/.test(sinar) && /q\.map\(x => faktor\(x\.p, x\.n\)\)/.test(sinar));
  //  Gizmo putar: lewat ±90° three.js menyimpan putaran sebagai Euler (180°, 180° - θ, 180°) - rot dari rotation.y
  //  saja salah (120° terbaca 60°) & sinar proyektor keluar dari samping badan, bukan dari lensa.
  const mesin = readFileSync('app/(portal)/tools-team/_components/desain3d/mesin/useMesin.ts', 'utf8');
  cek('putar gizmo > 90°: sudut dibaca dari arah muka benda (quaternion), bukan rotation.y',
    /new THREE\.Vector3\(0, 0, 1\)\.applyQuaternion\(o\.quaternion\)/.test(mesin) && !/o\.rotation\.y \* 180/.test(mesin));
  cek('Objek Saya ikut menyimpan pilihan Mask', /maskBidang: 'bool'/.test(readFileSync('lib/objek-saya.ts', 'utf8')));
}

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
