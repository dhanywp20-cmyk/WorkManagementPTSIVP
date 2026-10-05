/**
 * uji/desain3d.ts - geometri murni Desain 3D Ruang (Tools Team): salin benda
 * ke ruang sebelah, sinar & jarak lempar proyektor.
 *
 * Jalankan: npx tsx uji/desain3d.ts
 */
import {
  type Benda, type Kotak, type Ruang, bendaBaru, contohAwal, salinKeRuang, salinIsi, sesuaikanUkuranRuang, sinarProyektor, proyektorKeLayar, tiltKeLayar, keDunia, lensaProyektor, layarTerdekat,
  pusatkanIsi,
} from '../app/tools-team/_components/desain3d/model';
import { bacaDesainGLB, dataDesainFile, jsonDariGLB, namaFileDesain, KUNCI_DESAIN } from '../app/tools-team/_components/desain3d/file-glb';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const dekat = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

const R1: Kotak = { x0: 0, p: 8, l: 6, t: 3 };

console.log('\n1. Salin ke ruang sebelah - ukuran sama');
{
  const R2: Kotak = { x0: 8, p: 8, l: 6, t: 3 };
  const meja = bendaBaru('meja', R1);
  const c = salinKeRuang(meja, R1, R2);
  cek('posisi identik, bergeser selebar ruang 1', dekat(c.x, meja.x + 8) && dekat(c.z, meja.z) && c.elev === meja.elev, `${c.x},${c.z}`);
  cek('id baru, sifat lain sama', c.id !== meja.id && c.w === meja.w && c.d === meja.d && c.bentukMeja === meja.bentukMeja && c.rot === meja.rot);
}

console.log('\n2. Salin ke ruang sebelah - ruang tujuan lebih kecil (6 x 5 m, plafon 2,8 m)');
{
  const R2: Kotak = { x0: 8, p: 6, l: 5, t: 2.8 };
  const vw = bendaBaru('videowall', R1);
  const cv = salinKeRuang(vw, R1, R2);
  cek('videowall tetap menempel dinding depan & di tengah dinding', dekat(cv.z, vw.z) && dekat(cv.x, 11), `${cv.x},${cv.z}`);
  const spk = bendaBaru('speaker-plafon', R1);
  const cs = salinKeRuang(spk, R1, R2);
  cek('speaker plafon tetap rata plafon yang lebih rendah', dekat(cs.elev + cs.h, 2.8), `${cs.elev}`);
  const proj = bendaBaru('proyektor', R1, { pasangProyektor: 'plafon' });
  const cp = salinKeRuang(proj, R1, R2);
  cek('proyektor plafon: jarak gantung dari plafon sama', dekat(2.8 - cp.elev, 3 - proj.elev), `${cp.elev}`);
  const rak = bendaBaru('rak', R1);
  const cr = salinKeRuang(rak, R1, R2);
  cek('rack di pojok kanan tetap berjarak sama dari dinding kanan', dekat(R2.x0 + R2.p - cr.x, R1.p - rak.x), `${cr.x}`);
  const meja = bendaBaru('meja', R1);
  const kursi = { ...bendaBaru('kursi', R1), x: meja.x + 1.05, z: meja.z, rot: 270 };
  const cm = salinKeRuang(meja, R1, R2), ck = salinKeRuang(kursi, R1, R2);
  cek('susunan meja-kursi tidak merapat (jarak tetap 1,05 m)', dekat(ck.x - cm.x, 1.05) && dekat(cm.x, 11), `${cm.x} ${ck.x}`);
  cek('meja tetap di dalam ruang tujuan', cm.z - cm.d / 2 >= 0 && cm.z + cm.d / 2 <= R2.l, `${cm.z}`);
  const isi = [cv, cs, cp, cr, cm, ck];
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: { aktif: true, p: 6, l: 5, t: 2.8, lantai: 'karpet', pintu: true } };
  cek('semua salinan jatuh di ruang 2', isi.every(b => b.x > ruang.p && b.x < ruang.p + 6));
}

console.log('\n3. Proyektor & layar');
{
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  const layar = bendaBaru('layar', R1);                     // 120" 16:9 di dinding depan
  const p0 = bendaBaru('proyektor', R1, { pasangProyektor: 'plafon' });
  const p = proyektorKeLayar(p0, layar, R1, ruang);
  const lensa = keDunia(p, lensaProyektor(p));
  cek('menghadap layar (rot 180) & lensa segaris tengah layar', p.rot === 180 && dekat(lensa[0], layar.x), `${p.rot} ${lensa[0]}`);
  const s = sinarProyektor(p, [layar, p], ruang);
  cek('sinar mengenai layar', s.layar?.id === layar.id);
  cek('jarak lempar = throw ratio x lebar layar', dekat(s.jarak, 1.6 * layar.w, 0.02), `${s.jarak}`);
  cek('gambar pas selebar layar, TR perlu = 1,6', dekat(s.lebar, layar.w, 0.02) && dekat(s.trPas ?? 0, 1.6, 0.01), `${s.lebar} ${s.trPas}`);
  cek('pojok gambar di bidang layar', s.sudut.every(t => dekat(t[2], layar.z + layar.d / 2, 0.01)), `${s.sudut[0][2]}`);
  const maju = sinarProyektor({ ...p, z: p.z - 1 }, [layar, p], ruang);
  cek('proyektor dimajukan 1 m: gambar mengecil dari layar', maju.lebar < layar.w - 0.5, `${maju.lebar}`);
  const pBalik = { ...p, rot: 0 };
  const balik = sinarProyektor(pBalik, [layar, pBalik], ruang);
  const lensaBalik = keDunia(pBalik, lensaProyektor(pBalik));
  cek('membelakangi layar: tanpa sasaran, cahaya sampai dinding belakang', balik.layar === null && dekat(balik.jarak, R1.l - lensaBalik[2], 0.01), `${balik.jarak}`);
  const meja = sinarProyektor({ ...bendaBaru('proyektor', R1, { pasangProyektor: 'meja' }), rot: 180 }, [layar], ruang);
  cek('proyektor portabel menghadap layar ikut mengenai layar', meja.layar?.id === layar.id);

  //  Pan & tilt
  cek('proyektor plafon perlu menunduk agar gambar di tengah layar', (p.tilt ?? 0) < 0 && (p.tilt ?? 0) > -20, `${p.tilt}`);
  cek('setelah diposisikan: gambar tepat di tengah layar (tinggi & samping)', dekat(s.selisihV ?? 9, 0, 0.01) && dekat(s.selisihH ?? 9, 0, 0.02), `${s.selisihV} ${s.selisihH}`);
  const datar = sinarProyektor({ ...p, tilt: 0 }, [layar, p], ruang);
  cek('tanpa tilt gambar terlalu tinggi (keluar atas layar)', (datar.selisihV ?? 0) > 0.05, `${datar.selisihV}`);
  const lebihTunduk = sinarProyektor({ ...p, tilt: (p.tilt ?? 0) - 5 }, [layar, p], ruang);
  cek('menunduk lebih jauh: gambar turun di bawah tengah layar', (lebihTunduk.selisihV ?? 0) < -0.05, `${lebihTunduk.selisihV}`);
  cek('lensa ikut turun & mundur saat badan menunduk 20°', lensaProyektor({ ...p, tilt: -20 })[1] < lensaProyektor({ ...p, tilt: 0 })[1] - 0.05 && lensaProyektor({ ...p, tilt: -20 })[2] < lensaProyektor({ ...p, tilt: 0 })[2]);
  const pan = sinarProyektor({ ...p, rot: 190 }, [layar, p], ruang);
  cek('pan 10° ke samping: gambar bergeser menyamping', pan.layar?.id === layar.id && Math.abs(pan.selisihH ?? 0) > 0.3, `${pan.selisihH}`);
  const tunduk = tiltKeLayar({ ...p, tilt: 10 }, layar, ruang);
  cek('atur tilt otomatis dari posisi sembarang kembali ke tengah', dekat(sinarProyektor(tunduk, [layar, tunduk], ruang).selisihV ?? 9, 0, 0.01));
}

console.log('\n4. Proyektor di ruang lain tidak menembak layar ruang 1');
{
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet', pintu: true } };
  const layar = bendaBaru('layar', R1);
  const p: Benda = { ...bendaBaru('proyektor', { x0: 8, p: 6, l: 6, t: 3 }), x: 9, rot: 180 };
  cek('tanpa sasaran', sinarProyektor(p, [layar, p], ruang).layar === null);
  cek('layar terdekat hanya di ruang yang sama', layarTerdekat(p, [layar, p], ruang) === null);
}

console.log('\n5. Salin isi ruang: proyektor tetap menembak salinan layarnya');
{
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet', pintu: true } };
  const R2: Kotak = { x0: 8, p: 6, l: 6, t: 3 };
  //  Layar di dinding kiri ruang 1 (rot 90), proyektor plafon di jarak idealnya.
  const layar: Benda = { ...bendaBaru('layar', R1), x: 0.05, z: 3, rot: 90 };
  const proj = proyektorKeLayar(bendaBaru('proyektor', R1, { pasangProyektor: 'plafon' }), layar, R1, ruang);
  const asli = sinarProyektor(proj, [layar, proj], ruang);
  const [cl, cp] = salinIsi([layar, proj], ruang, R1, R2);
  const salin = sinarProyektor(cp, [cl, cp], ruang);
  cek('layar salinan tetap di dinding kiri ruang 2', dekat(cl.x, 8.05) && cl.rot === 90, `${cl.x}`);
  cek('jarak lempar & ukuran gambar sama dengan ruang asal', salin.layar?.id === cl.id && dekat(salin.jarak, asli.jarak) && dekat(salin.lebar, asli.lebar), `${salin.jarak} vs ${asli.jarak}`);
  const sendiri = salinKeRuang(proj, R1, R2);
  cek('(tanpa aturan ini jarak lempar akan berubah)', !dekat(sinarProyektor(sendiri, [cl, sendiri], ruang).jarak, asli.jarak));
}

console.log('\n6. Ukuran ruang diubah: isi ikut menyesuaikan');
{
  const lama: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet', pintu: true } };
  const isi = contohAwal(lama);
  const r2Meja = { ...bendaBaru('meja', { x0: 8, p: 6, l: 6, t: 3 }), id: 'r2meja' };
  const baru: Ruang = { ...lama, p: 10, l: 7 };
  const hasil = sesuaikanUkuranRuang([...isi, r2Meja], lama, baru);
  const cari = (j: string) => hasil.find(b => b.jenis === j)!;
  const asli = (j: string) => isi.find(b => b.jenis === j)!;
  cek('meja tetap di tengah ruang yang melebar (x 4 -> 5)', dekat(cari('meja').x, 5) && dekat(cari('meja').z, asli('meja').z + 0.5), `${cari('meja').x},${cari('meja').z}`);
  cek('videowall tetap menempel dinding depan, di tengah', dekat(cari('videowall').z, asli('videowall').z) && dekat(cari('videowall').x, 5));
  cek('rack tetap berjarak sama dari dinding kanan', dekat(10 - cari('rak').x, 8 - asli('rak').x), `${cari('rak').x}`);
  const kursi = hasil.filter(b => b.jenis === 'kursi'), kursiAsli = isi.filter(b => b.jenis === 'kursi');
  cek('kursi ikut bergeser bersama meja (jarak ke meja tetap)', kursi.every((k, i) => dekat(k.x - cari('meja').x, kursiAsli[i].x - asli('meja').x)));
  cek('isi Ruang 2 ikut bergeser 2 m saat Ruang 1 memanjang', dekat(hasil.find(b => b.id === 'r2meja')!.x, r2Meja.x + 2), `${hasil.find(b => b.id === 'r2meja')!.x}`);
  cek('id benda tidak berubah', hasil.every((b, i) => b.id === [...isi, r2Meja][i].id));
  const tetap = sesuaikanUkuranRuang(isi, lama, { ...lama, lantai: 'karpet' });
  cek('ukuran tidak berubah: tidak ada yang digeser', tetap === isi);
}

console.log('\n7. Pusatkan isi');
{
  //  Data lama: desain 8 x 6 m lalu ruangnya dilebarkan jadi 10 x 7 m tanpa
  //  penyesuaian - semua benda tertinggal di kiri depan.
  const lama: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  const isi = contohAwal(lama);
  const ruang: Ruang = { ...lama, p: 10, l: 7 };
  const hasil = pusatkanIsi(isi, ruang, 'xz');
  const cari = (j: string, daftar = hasil) => daftar.find(b => b.jenis === j)!;
  const meja = cari('meja');
  cek('meja tepat di tengah kiri-kanan', dekat(meja.x, 5), `${meja.x}`);
  const kursi = hasil.filter(b => b.jenis === 'kursi');
  const zMin = Math.min(...kursi.map(k => k.z - k.d / 2), meja.z - meja.d / 2), zMaks = Math.max(...kursi.map(k => k.z + k.d / 2), meja.z + meja.d / 2);
  cek('susunan meja-kursi tepat di tengah depan-belakang', dekat((zMin + zMaks) / 2, 3.5, 0.02), `${(zMin + zMaks) / 2}`);
  cek('jarak kursi ke meja tidak berubah', kursi.every((k, i) => dekat(k.x - meja.x, isi.filter(b => b.jenis === 'kursi')[i].x - cari('meja', isi).x)));
  const vw = cari('videowall');
  cek('videowall tetap menempel dinding depan, ikut ke tengah', dekat(vw.z, cari('videowall', isi).z) && dekat(vw.x, 5), `${vw.x},${vw.z}`);
  cek('rack tetap di dalam ruang', hasil.every(b => b.x >= 0 && b.x <= 10 && b.z >= 0 && b.z <= 7));
  const hanyaX = pusatkanIsi(isi, ruang, 'x');
  cek('"kiri-kanan saja": maju-mundur tidak berubah', dekat(cari('meja', hanyaX).x, 5) && dekat(cari('meja', hanyaX).z, cari('meja', isi).z));
  cek('sudah di tengah: tidak ada yang berubah', pusatkanIsi(hasil, ruang, 'xz') === hasil);

  //  Proyektor ikut layarnya (di dinding kiri: tidak bergeser kiri-kanan).
  const R: Kotak = { x0: 0, p: 8, l: 6, t: 3 };
  const ruang2: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  const layar: Benda = { ...bendaBaru('layar', R), x: 0.05, z: 3, rot: 90 };
  const proj = proyektorKeLayar(bendaBaru('proyektor', R, { pasangProyektor: 'plafon' }), layar, R, ruang2);
  const m1 = { ...bendaBaru('meja', R), x: 3, z: 2 };
  const [, p2] = pusatkanIsi([layar, proj, m1], ruang2, 'xz');
  const s1 = sinarProyektor(proj, [layar, proj], ruang2), s2 = sinarProyektor(p2, [layar, p2], ruang2);
  cek('proyektor yang menembak layar tetap pada jarak lemparnya', dekat(s1.jarak, s2.jarak) && dekat(p2.x, proj.x), `${s1.jarak} ${s2.jarak}`);
}

console.log('\n8. Simpan / buka di laptop (.glb)');
{
  //  GLB minimal: header 12 byte + chunk JSON (seperti keluaran GLTFExporter).
  const buatGLB = (json: unknown) => {
    let teks = JSON.stringify(json);
    while (teks.length % 4) teks += ' ';
    const isi = new TextEncoder().encode(teks);
    const buf = new ArrayBuffer(20 + isi.length);
    const dv = new DataView(buf);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, buf.byteLength, true);
    dv.setUint32(12, isi.length, true); dv.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(buf, 20).set(isi);
    return buf;
  };
  const ruang: Ruang = { p: 7, l: 5, t: 2.8, lantai: 'karpet', r2: { aktif: true, p: 6, l: 5, t: 2.8, lantai: 'kayu', pintu: true, sekat: 'kaca-kotak' } };
  const benda = contohAwal(ruang);
  const gambar = { [benda[0].id]: 'data:image/jpeg;base64,QUJD', palsu: 'javascript:alert(1)' };
  const glb = buatGLB({ asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ name: 'Desain', extras: { [KUNCI_DESAIN]: dataDesainFile('Ruang Rapat A', ruang, benda, gambar) } }] });
  const d = bacaDesainGLB(glb);
  cek('desain terbaca kembali dari .glb', !!d && d.nama === 'Ruang Rapat A' && d.benda.length === benda.length);
  cek('ruangan lengkap termasuk sekat kaca berpanel', d?.ruang.r2?.sekat === 'kaca-kotak' && d?.ruang.p === 7);
  cek('gambar layar ikut; data URL berbahaya dibuang', d?.gambar?.[benda[0].id] === 'data:image/jpeg;base64,QUJD' && !('palsu' in (d?.gambar ?? {})));
  cek('GLB model produk biasa (tanpa data desain) dikenali sebagai bukan desain', bacaDesainGLB(buatGLB({ asset: { version: '2.0' }, nodes: [{ name: 'Kursi' }] })) === null);
  cek('bukan file GLB: null, tidak error', bacaDesainGLB(new TextEncoder().encode('bukan glb sama sekali').buffer as ArrayBuffer) === null && jsonDariGLB(new ArrayBuffer(4)) === null);
  const rusak = buatGLB({ nodes: [{ extras: { [KUNCI_DESAIN]: { format: 'pts-desain-3d', versi: 1, nama: 'x', ruang, benda: [{ tanpaJenis: 1 }] } } }] });
  cek('data benda tidak sah ditolak', bacaDesainGLB(rusak) === null);
  cek('nama file aman', namaFileDesain('Ruang Rapat / Lt.3') === 'Ruang-Rapat-Lt-3.glb' && namaFileDesain('') === 'desain-av.glb');
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
