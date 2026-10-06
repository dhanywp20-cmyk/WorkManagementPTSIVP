/**
 * uji/desain3d.ts - geometri murni Desain 3D Ruang (Tools Team): salin benda
 * ke ruang sebelah, sinar & jarak lempar proyektor.
 *
 * Jalankan: npx tsx uji/desain3d.ts
 */
import {
  type Benda, type Kotak, type Ruang, bendaBaru, contohAwal, salinKeRuang, salinIsi, sesuaikanUkuranRuang, sinarProyektor, proyektorKeLayar, tiltKeLayar, keDunia, lensaProyektor, layarTerdekat,
  pusatkanIsi, jendelaSekat, pintuSekat, PINTU, ukuranPintu, spekVideowall, terapkanUkuran, ukuranLayar, ukuranIFP, warnaSah, tandaBentuk,
  bukaanDinding, sisiLuar, setRuangKelas, ukuranSetKelas, sebaranSpeaker, sebaranVSpeaker, jangkauanDari, berkasLineArray,
  templateRuang, KATEGORI_RUANG, kursiTribun, ukuranBidang, lengkungDari,
  luxLampuLangsung, luxCahayaDi, kontrasProyektor, setLampuGrid, luxBidangKerja, nyalaLampu, zoomLensa, arahkanKe, arahProyektor, tiltDari, titikPenonton, cakupanSpeakerPlafon, kecerahanProyektor, analisisDari, offsetLensaDari,
} from '../app/tools-team/_components/desain3d/model';
import * as M3 from '../app/tools-team/_components/desain3d/model';
import { ringkasanDesain as ringkasRuang } from '../lib/tools-team';
import { periksaProduk, bersihkanAturProduk, bacaDaftarProduk } from '../lib/tools-team';
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
  const ruang: Ruang = { p: 7, l: 5, t: 2.8, lantai: 'karpet', r2: { aktif: true, p: 6, l: 5, t: 2.8, lantai: 'kayu', pintu: true, sekat: 'jendela', jendela: { lebar: 2.4, tinggi: 1.2, ambang: 0.9, geser: 0 } } };
  const benda = contohAwal(ruang);
  const gambar = { [benda[0].id]: 'data:image/jpeg;base64,QUJD', palsu: 'javascript:alert(1)' };
  const glb = buatGLB({ asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ name: 'Desain', extras: { [KUNCI_DESAIN]: dataDesainFile('Ruang Rapat A', ruang, benda, gambar) } }] });
  const d = bacaDesainGLB(glb);
  cek('desain terbaca kembali dari .glb', !!d && d.nama === 'Ruang Rapat A' && d.benda.length === benda.length);
  cek('ruangan lengkap termasuk sekat jendela kaca', d?.ruang.r2?.sekat === 'jendela' && d?.ruang.r2?.jendela?.lebar === 2.4 && d?.ruang.p === 7);
  cek('gambar layar ikut; data URL berbahaya dibuang', d?.gambar?.[benda[0].id] === 'data:image/jpeg;base64,QUJD' && !('palsu' in (d?.gambar ?? {})));
  cek('GLB model produk biasa (tanpa data desain) dikenali sebagai bukan desain', bacaDesainGLB(buatGLB({ asset: { version: '2.0' }, nodes: [{ name: 'Kursi' }] })) === null);
  cek('bukan file GLB: null, tidak error', bacaDesainGLB(new TextEncoder().encode('bukan glb sama sekali').buffer as ArrayBuffer) === null && jsonDariGLB(new ArrayBuffer(4)) === null);
  const rusak = buatGLB({ nodes: [{ extras: { [KUNCI_DESAIN]: { format: 'pts-desain-3d', versi: 1, nama: 'x', ruang, benda: [{ tanpaJenis: 1 }] } } }] });
  cek('data benda tidak sah ditolak', bacaDesainGLB(rusak) === null);
  cek('nama file aman', namaFileDesain('Ruang Rapat / Lt.3') === 'Ruang-Rapat-Lt-3.glb' && namaFileDesain('') === 'desain-av.glb');
}

console.log('\n9. Sekat tembok + jendela kaca');
{
  const dasar: Ruang = { p: 7, l: 5, t: 2.8, lantai: 'karpet', r2: { aktif: true, p: 6, l: 5, t: 2.8, lantai: 'kayu', pintu: false, sekat: 'jendela' } };
  const j = jendelaSekat(dasar)!;
  cek('bawaan: 1 jendela 2 x 1,2 m di tengah sekat, 0,9 m dari lantai', dekat(j.z0, 1.5) && dekat(j.z1, 3.5) && dekat(j.y0, 0.9) && dekat(j.y1, 2.1), JSON.stringify(j));
  cek('sekat tembok / kaca penuh: tidak ada jendela', jendelaSekat({ ...dasar, r2: { ...dasar.r2!, sekat: 'tembok' } }) === null && jendelaSekat({ ...dasar, r2: { ...dasar.r2!, sekat: 'kaca' } }) === null);
  cek('satu ruang saja: tidak ada jendela', jendelaSekat({ ...dasar, r2: { ...dasar.r2!, aktif: false } }) === null);
  const besar = jendelaSekat({ ...dasar, r2: { ...dasar.r2!, jendela: { lebar: 30, tinggi: 9, ambang: 0.9, geser: 50 } } })!;
  cek('ukuran & geser berlebih dijepit di dalam dinding', besar.z0 >= 0.2 - 1e-9 && besar.z1 <= 4.8 + 1e-9 && besar.y1 <= 2.8 - 0.15 + 1e-9, JSON.stringify(besar));
  const berpintu: Ruang = { ...dasar, r2: { ...dasar.r2!, pintu: true } };
  const pintu = pintuSekat(berpintu)!;
  const jp = jendelaSekat(berpintu)!;
  cek('jendela tidak menabrak pintu sekat', jp.z1 <= pintu - PINTU.lebar / 2 || jp.z0 >= pintu + PINTU.lebar / 2, `pintu ${pintu}, jendela ${jp.z0}-${jp.z1}`);
  const geser = jendelaSekat({ ...dasar, r2: { ...dasar.r2!, jendela: { lebar: 1, tinggi: 1, ambang: 1, geser: -1 } } })!;
  cek('geser negatif = ke depan', dekat((geser.z0 + geser.z1) / 2, 1.5), JSON.stringify(geser));
}

console.log('\n10. Semua bisa custom: videowall, layar, IFP, rack, pintu, warna');
{
  const k = { x0: 0, p: 8, l: 6, t: 3 };
  //  Videowall model custom: ukuran total = panel x kolom/baris, resolusi & inci dari panel isian.
  const vw = terapkanUkuran({ ...bendaBaru('videowall', k), vw: 'custom', kol: 3, bar: 2,
    panel: { w: 1.0, h: 0.5, d: 0.08, bezelMm: 1.8, resX: 3840, resY: 2160, wTipikal: 200, wMaks: 400 } });
  cek('videowall custom: ukuran total = panel x 3 x 2', dekat(vw.w, 3.0) && dekat(vw.h, 1.0) && dekat(vw.d, 0.08), `${vw.w} ${vw.h} ${vw.d}`);
  const sp = spekVideowall(vw);
  cek('videowall custom: resolusi & inci dari isian', sp.resX === 3840 && sp.inci === Math.round(Math.hypot(1, 0.5) / 0.0254), `${sp.inci}`);
  cek('videowall katalog tetap memakai datasheet Philips', dekat(spekVideowall({ vw: '55BDL2105X' }).w, 1.2135) && spekVideowall({}).resX === 1920);
  //  Rasio layar tambahan.
  const r169 = ukuranLayar(100, '16:9'), r1610 = ukuranLayar(100, '16:10'), r219 = ukuranLayar(100, '21:9');
  cek('rasio 16:10 & 21:9 benar', dekat(r1610.w / r1610.h, 1.6, 0.001) && dekat(r219.w / r219.h, 21 / 9, 0.001) && dekat(r169.w / r169.h, 16 / 9, 0.001));
  cek('rasio rusak jatuh ke 16:9', dekat(ukuranLayar(100, 'abc').w, r169.w));
  //  IFP diagonal custom.
  const i98 = ukuranIFP(98);
  cek('IFP 98" custom diperkirakan dari diagonal (+bezel)', i98.w > 2.2 && i98.w < 2.25 && dekat(i98.h / (i98.w), (1.2448 + 0.06) / (2.1690 + 0.06), 0.02), `${i98.w} x ${i98.h}`);
  cek('IFP 75" tetap tabel datasheet', dekat(ukuranIFP(75).w, 1.712));
  //  Pintu penghubung custom.
  const dua: Ruang = { p: 7, l: 5, t: 2.8, lantai: 'karpet', r2: { aktif: true, p: 6, l: 5, t: 2.8, lantai: 'kayu', pintu: true, sekat: 'jendela',
    pintuUkuran: { lebar: 1.6, tinggi: 2.4, z: 1.2 } } };
  const up = ukuranPintu(dua), pz = pintuSekat(dua)!;
  cek('pintu custom: lebar/tinggi/posisi dipakai', dekat(up.lebar, 1.6) && dekat(up.tinggi, 2.4) && dekat(pz, 1.2), `${up.lebar} ${up.tinggi} ${pz}`);
  const jd = jendelaSekat(dua)!;
  cek('jendela menghindari pintu custom yang lebih lebar', jd.z0 >= pz + up.lebar / 2 || jd.z1 <= pz - up.lebar / 2, `pintu ${pz}±${up.lebar / 2}, jendela ${jd.z0}-${jd.z1}`);
  const lebay: Ruang = { ...dua, r2: { ...dua.r2!, pintuUkuran: { lebar: 20, tinggi: 9, z: 99 } } };
  const ul = ukuranPintu(lebay), zl = pintuSekat(lebay)!;
  cek('pintu kebesaran/kelewat ujung dijepit di dalam sekat', ul.lebar <= 5 - 0.4 + 1e-9 && ul.tinggi <= 2.8 - 0.1 + 1e-9 && zl + ul.lebar / 2 <= 5 + 1e-9, `${ul.lebar} ${ul.tinggi} ${zl}`);
  cek('tanpa pintuUkuran = ukuran & posisi lama', dekat(ukuranPintu({ ...dua, r2: { ...dua.r2!, pintuUkuran: undefined } }).lebar, PINTU.lebar)
    && dekat(pintuSekat({ ...dua, r2: { ...dua.r2!, pintuUkuran: undefined } })!, 4.0));
  //  Warna.
  cek('warna sah hanya #rrggbb', warnaSah('#A1B2C3') === '#a1b2c3' && warnaSah('red') === undefined && warnaSah('#12345') === undefined && warnaSah(7) === undefined);
  const kursi = bendaBaru('kursi', k);
  cek('ganti warna / panel memicu bangun ulang model', tandaBentuk(kursi) !== tandaBentuk({ ...kursi, warna: '#ff0000' })
    && tandaBentuk(vw) !== tandaBentuk({ ...vw, panel: { ...vw.panel!, bezelMm: 3 } }));
}

console.log('\n11. Batch 2: bukaan, set kelas, jangkauan, proyektor, signage, Produk saya, analisis');
{
  const k = { x0: 0, p: 8, l: 6, t: 3 };
  //  Pintu & jendela dinding luar.
  const satu: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', bukaan: [
    { id: 'p1', ruang: 0, sisi: 'belakang', jenis: 'pintu', posisi: 2, lebar: 0.9, tinggi: 2.1, ambang: 0.5 },
    { id: 'j1', ruang: 0, sisi: 'kiri', jenis: 'jendela', posisi: 50, lebar: 9, tinggi: 5, ambang: 0.9 },
  ] };
  const pintu = bukaanDinding(satu, 0, 'belakang');
  cek('pintu luar: posisi dari kiri, mulai dari lantai (ambang diabaikan)', pintu.length === 1 && dekat(pintu[0].x0, 1.55) && dekat(pintu[0].x1, 2.45) && pintu[0].y0 === 0 && dekat(pintu[0].y1, 2.1));
  const jd = bukaanDinding(satu, 0, 'kiri')[0];
  cek('jendela kebesaran & kelewat ujung dijepit di dalam dinding', jd.x0 >= 0.1 - 1e-9 && jd.x1 <= 6 - 0.1 + 1e-9 && jd.y1 <= 3 - 0.05 + 1e-9 && dekat(jd.y0, 0.9), JSON.stringify(jd));
  cek('dinding tanpa bukaan: kosong', bukaanDinding(satu, 0, 'depan').length === 0);
  const dua: Ruang = { ...satu, r2: { aktif: true, p: 6, l: 6, t: 3, lantai: 'kayu', pintu: false }, bukaan: [{ id: 'x', ruang: 0, sisi: 'kanan', jenis: 'jendela', posisi: 3, lebar: 1, tinggi: 1, ambang: 1 }] };
  cek('dinding sekat bukan dinding luar (bukaan di sana tidak digambar)', !sisiLuar(dua, 0).includes('kanan') && !sisiLuar(dua, 1).includes('kiri') && bukaanDinding(dua, 0, 'kanan').length === 0);
  cek('ruang 2 tidak aktif: bukaannya tidak digambar', bukaanDinding({ ...satu, bukaan: [{ ...satu.bukaan![0], ruang: 1 }] }, 1, 'belakang').length === 0);
  //  Set ruang kelas custom.
  const set = setRuangKelas(k, { kolom: 3, baris: 2, kursiPerMeja: 3, pengajar: false });
  cek('set kelas 3 x 2 meja, 3 kursi per meja, tanpa meja pengajar', set.filter(b => b.jenis === 'meja').length === 6 && set.filter(b => b.jenis === 'kursi').length === 18);
  const otomatis = ukuranSetKelas(k);
  cek('set kelas otomatis sama seperti sebelumnya (2 kursi/meja + meja pengajar)', setRuangKelas(k).filter(b => b.jenis === 'kursi').length === otomatis.kolom * otomatis.baris * 2
    && setRuangKelas(k).some(b => b.nama === 'Meja pengajar'));
  //  Kamera & speaker.
  //  Speaker: tipe & sebaran/jangkauan bawaan.
  const s6 = bendaBaru('speaker', k, { tipeSpeaker: 'dinding6' }), sk = bendaBaru('speaker', k), sp = bendaBaru('speaker', k, { tipeSpeaker: 'kolom' });
  cek('speaker dinding 6" & kotak (lama tetap) & portable: ukuran/tinggi bawaan', s6.nama === 'Speaker dinding 6"' && dekat(s6.w, 0.2) && s6.elev === 2
    && sk.tipeSpeaker === 'kotak' && dekat(sk.w, 0.21) && sp.elev === 0 && dekat(sp.h, 2));
  cek('sebaran bawaan: dinding 90x90, portable 120x30, line array 100 x 10/modul', sebaranSpeaker(s6) === 90 && sebaranVSpeaker(s6) === 90
    && sebaranSpeaker(sp) === 120 && sebaranVSpeaker(sp) === 30 && sebaranVSpeaker(bendaBaru('speaker', k, { tipeSpeaker: 'linearray' })) === 10
    && jangkauanDari(sp) === 25);
  //  Line array: jumlah modul & berkas per modul.
  const la = bendaBaru('speaker', k, { tipeSpeaker: 'linearray', modul: 6 });
  cek('line array 6 modul: tinggi 6 x 0,3 m, nama ikut jumlah modul', dekat(la.h, 1.8) && la.nama === 'Line array 6 modul' && la.modul === 6);
  const lurus = berkasLineArray({ ...la, elev: 0 });
  cek('line array lurus di lantai: 6 berkas mendatar, tidak jatuh ke telinga', lurus.length === 6 && lurus.every(x => dekat(x.arah[1], 0) && x.jatuh === null));
  const flown = { ...la, gantung: true, elev: 4, tiltLA: 4, sudutModul: 3, rot: 0, x: 4, z: 0.5 };
  const bf = berkasLineArray(flown);
  cek('line array digantung & menekuk: modul bawah menunduk lebih dalam & jatuh lebih dekat', bf.every(x => x.jarak !== null)
    && bf.every((x, i) => i === 0 || (x.arah[1] < bf[i - 1].arah[1] && x.jarak! < bf[i - 1].jarak!)), bf.map(x => x.jarak?.toFixed(1)).join(','));
  const atas = bf[0];
  cek('berkas modul teratas: tilt 4° -> jatuh sejauh (tinggi - 1,2) / tan 4°', dekat(atas.jarak!, (atas.asal[1] - 1.2) / Math.tan(4 * Math.PI / 180) + (atas.asal[2] - 0.5), 0.05), `${atas.jarak}`);
  const spp = { ...bendaBaru('speaker-plafon', k), elev: 2.94, sebaran: 90 };
  cek('cakupan speaker plafon 90° dari 2,94 m = jari-jari (2,94-1,2)·tan45°', dekat(cakupanSpeakerPlafon(spp), 1.74) && sebaranSpeaker(bendaBaru('speaker', k)) === 90);
  //  Proyektor: offset lensa & lens shift.
  const r: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu' };
  const layar = { ...bendaBaru('layar', k), x: 4, z: 0.05, elev: 0.9 };
  const proj = proyektorKeLayar(bendaBaru('proyektor', k), layar, k, r);
  const s0 = sinarProyektor(proj, [layar, proj], r);
  const s1 = sinarProyektor({ ...proj, geserLensaH: 0.2 }, [layar, proj], r);
  cek('lens shift H 20% menggeser gambar 0,2 x lebar ke kanan (dilihat dari proyektor)', dekat((s1.selisihH ?? 0) - (s0.selisihH ?? 0), 0.2 * s0.lebar, 0.01), `${s0.selisihH} -> ${s1.selisihH}`);
  const s2 = sinarProyektor({ ...proj, offsetLensa: 0 }, [layar, proj], r);
  cek('offset 0% memindahkan gambar setengah tinggi gambar (dari offset 100%)', dekat(Math.abs((s2.selisihV ?? 0) - (s0.selisihV ?? 0)), 0.5 * s0.tinggi, 0.01) && offsetLensaDari(proj) === 0.5);
  const c = kecerahanProyektor({ ...proj, lumen: 5000 }, 2.66 * 1.5);
  cek('kecerahan: lux = lumen / luas, nits = lux / pi', dekat(c.lux, 5000 / 3.99, 0.5) && dekat(c.nits, c.lux / Math.PI, 0.01) && c.nada === 'baik');
  //  Signage display.
  const sg = bendaBaru('tv', k, { diag: 55, nama: 'Signage 55"' });
  cek('signage 55": area aktif 16:9 + bezel ±12 mm (≈1,234 x 0,705 m)', dekat(sg.w, 1.2176 + 0.024, 0.003) && dekat(sg.h, 0.6849 + 0.024, 0.003) && sg.nama === 'Signage 55"', `${sg.w} x ${sg.h}`);
  cek('signage standfloor berdiri di lantai (elev meja-stand), bukan di dinding', bendaBaru('tv', k, { pasang: 'standfloor' }).elev === 0.75);
  //  Produk saya (validasi server).
  const vwc = terapkanUkuran({ ...bendaBaru('videowall', k), vw: 'custom', panel: { w: 1, h: 0.5, d: 0.08, bezelMm: 1.8, resX: 3840, resY: 2160, wTipikal: 200, wMaks: 400 } });
  const ok = periksaProduk({ label: '  Samsung VH55R ', ket: 'videowall', jenis: 'videowall', atur: { ...vwc, id: 'x', x: 9, z: 9, rot: 90, konten: 'gambar', modelKunci: 'k', warna: '#ABCDEF', jahat: '<script>' } });
  cek('Produk saya: label dirapikan, id/posisi/kunci asing dibuang, panel & warna disimpan',
    ok.ok && ok.data.label === 'Samsung VH55R' && !('id' in ok.data.atur) && !('x' in ok.data.atur) && !('rot' in ok.data.atur) && !('jahat' in ok.data.atur)
    && !('konten' in ok.data.atur) && !('modelKunci' in ok.data.atur) && ok.data.atur.warna === '#abcdef' && (ok.data.atur.panel as { resX: number }).resX === 3840);
  cek('Produk saya: jenis model GLB / tanpa ukuran / tanpa nama ditolak', !periksaProduk({ label: 'x', jenis: 'model', atur: vwc }).ok
    && !periksaProduk({ label: 'x', jenis: 'tv', atur: { w: 1 } }).ok && !periksaProduk({ label: ' ', jenis: 'tv', atur: vwc }).ok);
  cek('Produk saya: angka di luar batas & enum asing dibuang', !('w' in bersihkanAturProduk({ w: -1 })) && !('vw' in bersihkanAturProduk({ vw: 'X' })) && bersihkanAturProduk({ tipeKamera: 'xbar' }).tipeKamera === 'xbar');
  const atLA = bersihkanAturProduk({ tipeSpeaker: 'linearray', modul: 8, sudutModul: 3, tiltLA: 5, gantung: true, sebaranV: 10, fov: 70 });
  cek('Produk saya: line array (modul, sudut, gantung) tersimpan; field lama fov dibuang', atLA.tipeSpeaker === 'linearray' && atLA.modul === 8 && atLA.gantung === true && atLA.sudutModul === 3 && !('fov' in atLA));
  cek('Produk saya: baris rusak di app_settings diabaikan', bacaDaftarProduk({ daftar: [{ id: 'a', label: 'ok', jenis: 'tv', atur: { w: 1, h: 1, d: 0.1 } }, { label: 'tanpa id', jenis: 'tv', atur: { w: 1, h: 1, d: 1 } }, 5] }).length === 1
    && bacaDaftarProduk(null).length === 0);
  //  Analisis tersimpan bersama desain.
  cek('analisis bawaan & tersimpan', analisisDari({ p: 1, l: 1, t: 1, lantai: 'kayu' }).sudut === 45 && analisisDari({ p: 1, l: 1, t: 1, lantai: 'kayu', analisis: { jenis: 'custom', faktor: 3, sudut: 30 } }).faktor === 3);
}

console.log('\n12. Kategori ruangan, tribun, bidang mapping, zoom, arah proyektor');
{
  const k = { x0: 0, p: 16, l: 20, t: 7 };
  //  Template: semua kategori menghasilkan ruangan & isi, benda di dalam ruangan.
  for (const kat of KATEGORI_RUANG) {
    const t = templateRuang(kat.id);
    const luar = t.benda.filter(b => !(b.x >= -0.01 && b.x <= t.ruang.p + 0.01 && b.z >= -0.01 && b.z <= t.ruang.l + 0.01 && b.elev + b.h <= t.ruang.t + 0.05));
    cek(`template ${kat.judul}: ${t.benda.length} benda, semua di dalam ruangan`, t.benda.length > 0 && luar.length === 0,
      luar.map(b => `${b.nama}@${b.x.toFixed(1)},${b.z.toFixed(1)} atas ${(b.elev + b.h).toFixed(2)}`).join('; '));
  }
  const imm = templateRuang('immersive');
  cek('immersive: 4 proyektor dinding + 2 lantai (tilt -90°), ruang gelap', imm.benda.filter(b => b.jenis === 'proyektor').length === 6
    && imm.benda.filter(b => tiltDari(b) === -90).length === 2 && imm.ruang.cahaya === 'gelap');
  cek('immersive: UST dinding TR 0,25, lensa 1,5 m dari dinding -> gambar 6 m = lebar dinding', imm.benda.filter(b => tiltDari(b) !== -90).every(b => {
    const l = keDunia(b, lensaProyektor(b));
    return dekat(b.throwRatio ?? 0, 0.25) && dekat(Math.min(l[0], 6 - l[0], l[2], 6 - l[2]), 1.5, 0.002);
  }));
  for (const id of ['mapping-lengkung', 'mapping-cembung', 'mapping-objek'] as const) {
    const t = templateRuang(id);
    cek(`${id}: ruang abu-abu & redup (bukan hitam)`, t.ruang.warnaDinding === '#9ca3af' && t.ruang.cahaya === 'redup');
  }
  const cbg = templateRuang('mapping-cembung').benda.find(b => b.jenis === 'bidang')!;
  cek('mapping cembung = layar cembung lebar 6 m melengkung 60 cm (bukan pilar)', cbg.bentukBidang === 'cembung' && dekat(cbg.w, 6, 0.01) && dekat(cbg.d, 0.6, 0.01) && (cbg.busur ?? 0) < 180);
  //  Tribun.
  const tb = bendaBaru('tribun', k, { baris: 10, kursiBaris: 20, tinggiAnak: 0.3 });
  cek('tribun 10 x 20: 200 kursi, lebar 20 x 0,55 + 0,6, tinggi (n-1) x 0,3 + 0,95', kursiTribun(tb).length === 200 && dekat(tb.w, 11.6) && dekat(tb.d, 9) && dekat(tb.h, 3.65), `${tb.w} ${tb.d} ${tb.h}`);
  const ks = kursiTribun({ ...tb, rot: 180, x: 8, z: 15 });
  cek('kursi tribun menghadap depan: baris belakang lebih jauh dari dinding depan & lebih tinggi', ks[ks.length - 1].z > ks[0].z && ks[ks.length - 1].y > ks[0].y);
  cek('kursi tribun ikut jadi penonton di analisis', titikPenonton([{ ...tb, x: 8, z: 15 }]).length === 200);
  //  Bidang mapping.
  const lk = ukuranBidang({ ...tb, jariBidang: 7, busur: 100 });
  cek('bidang lengkung R7 100°: tali busur 2R sin50° & kedalaman R(1-cos50°)', dekat(lk.w, 14 * Math.sin(50 * Math.PI / 180), 0.002) && dekat(lk.d, 7 * (1 - Math.cos(50 * Math.PI / 180)), 0.002));
  const ld = lengkungDari(6, 0.6);
  cek('lengkungDari: lebar 6 m, kedalaman 0,6 m -> R 7,8 m', dekat(ld.jariBidang, 7.8, 0.001) && dekat(ukuranBidang({ ...tb, ...ld }).w, 6, 0.01) && dekat(ukuranBidang({ ...tb, ...ld }).d, 0.6, 0.01));
  const datar = bendaBaru('bidang', k, { bentukBidang: 'datar' });
  cek('layar mapping datar: lebar bebas, tebal 6 cm', datar.bentukBidang === 'datar' && dekat(datar.d, 0.06) && dekat(terapkanUkuran({ ...datar, w: 8 }).w, 8));
  const pil = ukuranBidang({ ...tb, jariBidang: 1.2, busur: 360 });
  cek('pilar 360°: tapak 2R x 2R', dekat(pil.w, 2.4) && dekat(pil.d, 2.4));
  //  Zoom & arah proyektor.
  const pj = bendaBaru('proyektor', k);
  cek('zoom lensa bawaan proyektor plafon 1,39-2,09; tanpa isian = lensa tetap', zoomLensa(pj)[0] === 1.39 && zoomLensa(pj)[1] === 2.09
    && zoomLensa({ ...pj, trMin: undefined, trMax: undefined, throwRatio: 1.7 })[0] === 1.7);
  const ke = arahkanKe({ ...pj, x: 5, z: 5, elev: 3.5, h: 0.14 }, [5, 0, 5]);
  cek('arahkan proyektor tegak ke lantai = tilt -90°, sumbu ke bawah', tiltDari(ke) === -90 && dekat(arahProyektor(ke)[1], -1));
  const ke2 = arahkanKe({ ...pj, x: 5, z: 5, elev: 2, h: 0.14 }, [5, 2.07, 0]);
  cek('arahkan ke dinding depan: pan 180°, tilt 0°', dekat(ke2.rot, 180) && dekat(tiltDari(ke2), 0, 0.2), `${ke2.rot} ${ke2.tilt}`);
}

console.log('\n13. Lampu plafon & kontras proyektor');
{
  const ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null } as Ruang;
  const k = { x0: 0, p: 8, l: 6, t: 3 };
  const dl = { ...bendaBaru('lampu', k, { tipeLampu: 'downlight' }), x: 4, z: 3 };
  //  Tepat di bawah downlight 1000 lm sinar 60°: I0 = phi (m+1)/2pi, m dari intensitas 50% di 30°.
  const m = Math.log(0.5) / Math.log(Math.cos(Math.PI / 6));
  const harap = (1000 * (m + 1)) / (2 * Math.PI) / Math.pow(dl.elev - 0.75, 2);
  cek('downlight 1000 lm: lux tepat di bawah = I0 / d²', dekat(luxLampuLangsung(dl, ruang, [4, 0.75, 3], [0, 1, 0]), harap, 0.5), `${harap.toFixed(1)}`);
  //  Integral lux di lantai luas ~ fluks lampu (energi kekal).
  let total = 0;
  for (let x = -20; x < 20; x += 0.1) for (let z = -20; z < 20; z += 0.1) total += luxLampuLangsung(dl, ruang, [4 + x + 0.05, 0, 3 + z + 0.05], [0, 1, 0]) * 0.01;
  cek('fluks yang jatuh ke lantai ±1000 lm (selisih < 5%)', Math.abs(total - 1000) < 50, total.toFixed(0));
  cek('dimmer 50% lampu x 50% ruangan = 25%', dekat(nyalaLampu({ ...dl, dimmer: 50 }, { ...ruang, dimmer: 50 }), 0.25));
  cek('permukaan menghadap menjauh tidak menerima cahaya', luxLampuLangsung(dl, ruang, [4, 0.75, 3], [0, -1, 0]) === 0);
  const grid = setLampuGrid(k);
  cek('set downlight grid 8 x 6 m: 4 x 3 lampu', grid.length === 12 && grid.every(b => b.jenis === 'lampu'));
  const rata = luxBidangKerja(grid, ruang, 0);
  cek('12 downlight 1000 lm di 48 m² -> rata-rata meja wajar (100-400 lux)', rata.rata > 100 && rata.rata < 400, rata.rata.toFixed(0));
  cek('tanpa lampu: perkiraan dari pilihan cahaya ruangan', luxCahayaDi([], { ...ruang, cahaya: 'redup' }, [4, 1.5, 0.1], [0, 0, 1]).total === 80);
  //  Kontras proyektor: layar di dinding depan, lampu menyala vs mati.
  const lyr = { ...bendaBaru('layar', k, { diag: 120 }), x: 4 };
  const pj = proyektorKeLayar({ ...bendaBaru('proyektor', k), x: 4, z: 4.5, lumen: 5000 }, lyr, k, ruang);
  const nyala = kontrasProyektor(pj, [lyr, pj, ...grid], ruang, 15), mati = kontrasProyektor(pj, [lyr, pj, ...grid], { ...ruang, dimmer: 0 }, 15);
  cek('kontras = (lux gambar + lux lampu) / lux lampu', dekat(nyala.kontras, (nyala.luxGambar + nyala.cahaya.total) / nyala.cahaya.total, 0.001));
  cek('lampu dimatikan -> kontras naik & memenuhi target', mati.kontras > nyala.kontras && mati.cukup, `${nyala.kontras.toFixed(1)} -> ${mati.kontras.toFixed(1)}`);
  cek('lumen perlu = (target-1) x lux lampu x luas gambar', nyala.lumenPerlu >= (15 - 1) * nyala.cahaya.total * nyala.luas - 1);
}

console.log('\nLebih dari 2 ruang & ruang bentuk L');
{
  const sb = (p: number, l: number, sekat?: 'tembok' | 'kaca' | 'jendela' | 'terbuka') => ({ aktif: true, p, l, t: 3, lantai: 'karpet' as const, pintu: true, sekat });
  const r: M3.Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: sb(6, 6), lain: [sb(4, 10, 'terbuka'), sb(5, 5)] };
  const k = M3.daftarRuang(r);
  cek('4 ruang berurutan: x0 = 0, 8, 14, 18', k.map(x => x.x0).join(',') === '0,8,14,18');
  cek('ruangDari memetakan x ke ruang 0..3', [1, 9, 15, 20].map(x => M3.ruangDari(r, x)).join(',') === '0,1,2,3');
  cek('dinding luar: ruang tengah tanpa kiri/kanan, ruang terakhir punya kanan', M3.sisiLuar(r, 1).join(',') === 'depan,belakang' && M3.sisiLuar(r, 3).includes('kanan') && !M3.sisiLuar(r, 3).includes('kiri'));
  cek('sekat terbuka (ruang L): tidak ada pintu penghubung', M3.pintuSekat(r, 2) === null && M3.pintuSekat(r, 1) !== null);
  cek('pintu sekat ke-3 dijepit di lebar ruang tersempit', (M3.pintuSekat(r, 3) ?? 0) <= Math.min(10, 5) - 0.45);
  const putus: M3.Ruang = { ...r, r2: { ...sb(6, 6), aktif: false } };
  cek('ruang 2 tidak aktif: ruang 3 & 4 ikut tidak tampil', M3.daftarRuang(putus).length === 1);
  cek('desain lama (hanya r2) tetap 2 ruang', M3.daftarRuang({ p: 8, l: 6, t: 3, lantai: 'kayu', r2: sb(6, 6) }).length === 2);
  const lebih: M3.Ruang = { ...r, lain: [sb(4, 4), sb(4, 4), sb(4, 4), sb(4, 4)] };
  cek(`maksimal ${M3.MAKS_RUANG} ruang`, M3.daftarRuang(lebih).length === M3.MAKS_RUANG);
  cek('ringkasan desain (Request Design) menghitung semua ruang', ringkasRuang({ ruang: r, benda: [] }).ruang.length === 4);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
