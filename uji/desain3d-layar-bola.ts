import {
  type Benda, bendaBaru, bolaBidang, cekRuangGerak, daftarRuang, jarakProyeksi, mataPilot, PESAWAT_ACUAN, permukaanBenda, type Ruang, type Titik,
  terapkanUkuran, tinggiMaksBola, ukuranBidang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const dekat = (a: number, b: number, t = 1e-3) => Math.abs(a - b) <= t;
const ruang: Ruang = { p: 8, l: 8, t: 3.2, lantai: 'kayu', r2: null };
const k = daftarRuang(ruang)[0];

function bola(x: Partial<Benda> = {}): Benda {
  return terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'bola', jariBidang: 2.5, busur: 225 }), id: 'l', x: 4, z: 2.5, h: 2, elev: 0.4, rot: 0, ...x } as Benda);
}
function pusat(b: Benda): Titik {
  const bl = bolaBidang(b), r = (b.rot * Math.PI) / 180;
  return [b.x + bl.zP * Math.sin(r), b.elev + bl.yP, b.z + bl.zP * Math.cos(r)];
}
const kurang = (a: Titik, b: Titik): Titik => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const panjang = (a: Titik) => Math.hypot(a[0], a[1], a[2]);
const satuan = (a: Titik): Titik => { const l = panjang(a); return [a[0] / l, a[1] / l, a[2] / l]; };

console.log('\n1. Ukuran & tapak');
const b0 = bola();
const u = ukuranBidang(b0), ul = ukuranBidang({ ...b0, bentukBidang: 'lengkung' });
cek('tapak bola = tapak silinder dengan jari-jari & busur yang sama', u.w === ul.w && u.d === ul.d);
cek('tinggi dibatasi ±75° dari pusat bola', terapkanUkuran({ ...b0, h: 9 }).h === tinggiMaksBola(2.5) && dekat(tinggiMaksBola(2.5), 4.83, 0.01));
const bl0 = bolaBidang(b0);
cek('sudut tegak tinggi 2 m, R 2,5 m = ±23,6°', dekat((bl0.fiM * 180) / Math.PI, 23.58, 0.05));

console.log('\n2. Permukaan bola (rot 0 & diputar)');
for (const rot of [0, 90, 215]) {
  const b = bola({ rot }), P = permukaanBenda(b), C = pusat(b);
  const diBola = P.sampel.every(s => dekat(panjang(kurang(s.p, C)), 2.5, 1e-6));
  const keTengah = P.sampel.every(s => { const d = satuan(kurang(C, s.p)); return dekat(d[0], s.n[0], 1e-6) && dekat(d[1], s.n[1], 1e-6) && dekat(d[2], s.n[2], 1e-6); });
  const ys = P.sampel.map(s => s.p[1]);
  cek(`rot ${rot}°: semua titik sampel berjarak R dari pusat, normal menghadap pusat`, diBola && keTengah);
  cek(`rot ${rot}°: tinggi layar dari ${b.elev} sampai ${b.elev + b.h} m`, dekat(Math.min(...ys), b.elev) && dekat(Math.max(...ys), b.elev + b.h));
  const kena = P.sampel.filter((_, i) => i % 37 === 0).every(s => { const t = P.kena(C, satuan(kurang(s.p, C))); return t !== null && dekat(t, 2.5, 1e-6); });
  cek(`rot ${rot}°: sinar dari pusat mengenai tiap titik sampel tepat di jarak R`, kena);
  const r = (rot * Math.PI) / 180, maju: Titik = [-Math.sin(r), 0, -Math.cos(r)];
  cek(`rot ${rot}°: sinar ke atas melewati tepi atas & ke belakang (bukaan) tidak kena`,
    P.kena(C, satuan([maju[0], 0.9, maju[2]])) === null && P.kena(C, [-maju[0], 0, -maju[2]]) === null && P.kena(C, maju) !== null);
}

console.log('\n3. Jarak proyeksi ke layar bola');
const proj: Benda = { ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), id: 'p', x: 4, z: pusat(b0)[2], elev: pusat(b0)[1] - 0.07, rot: 180, tilt: 0, offsetLensa: 0 };
const jp = jarakProyeksi(proj, [b0, proj], ruang);
cek(`proyektor di pusat bola menghadap depan: layar ${jp.sasaran?.nama ?? '-'} di ±2,5 m`, jp.sasaran?.id === 'l' && dekat(jp.jarak ?? 0, 2.5, 0.25));

console.log('\n4. Pesawat simulator');
const pesawat: Benda = { ...bendaBaru('objek', k, { bentukObjek: 'pesawat' }), id: 'ps', x: 4, z: 4 };
cek('ukuran bawaan pesawat = acuan (bentang 1,8 × tinggi 1,75 × panjang 3 m)', pesawat.w === PESAWAT_ACUAN.w && pesawat.h === PESAWAT_ACUAN.h && pesawat.d === PESAWAT_ACUAN.d);
const m0 = mataPilot(pesawat), m180 = mataPilot({ ...pesawat, rot: 180 });
cek('mata pilot 25 cm di depan tengah badan (rot 0 = hidung ke depan / -Z), tinggi 1,38 m', dekat(m0[0], 4) && dekat(m0[1], 1.38) && dekat(m0[2], 3.75));
cek('pesawat diputar 180°: mata pindah ke belakang tengah badan', dekat(m180[2], 4.25) && dekat(m180[0], 4));
const bl = bolaBidang(b0), C0 = pusat(b0);
const diDalam: Benda = { ...pesawat, x: C0[0], z: C0[2] + 0.25, elev: C0[1] - 1.38 };
cek('pesawat dengan mata di pusat bola tidak bertumpuk dengan layar', !cekRuangGerak([b0, diDalam], ruang).some(c => c.kode === 'tumpang') && bl.R === 2.5);
cek('pesawat yang hidungnya menembus layar -> tumpang', cekRuangGerak([b0, { ...diDalam, z: C0[2] - 1.5 }], ruang).some(c => c.kode === 'tumpang'));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
