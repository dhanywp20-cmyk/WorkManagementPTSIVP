/**
 * uji/desain3d-ukuran.ts - Ukuran & perhitungan Desain 3D yang dulu meleset:
 *  1. tinggi ruangan (plafon) tampil di kanvas 3D & denah;
 *  2. ubah tinggi plafon / salin ke ruang lain tidak merusak arah proyektor ke layar;
 *  3. gambar proyektor selalu 16:9 (layar 4:3 / 16:10 / 21:9 tetap tertutup, angka lux benar);
 *  4. aturan jarak pandang 4-6-8 memakai tinggi GAMBAR, bukan bodi TV / IFP;
 *  5. benda yang diturunkan karena plafon lebih rendah tidak menembus plafon;
 *  7. proyektor boleh tertanam di plafon / dinding (hanya lensa di dalam ruang);
 *  8. kartu keterangan blending bisa disembunyikan (bawaan) & dibuka per area.
 *
 * Jalankan: npm test -- desain3d-ukuran
 */
import { readFileSync } from 'fs';
import {
  bendaBaru, cakupanProyektor, daftarRuang, denahDari, JARAK_LENSA_PERMUKAAN, jepitProyektor, KATEGORI_RUANG, keDunia, lensaProyektor,
  permukaanBenda, proyektorKeLayar, salinIsi, barisKeterangan, bomDesain, contohAwal, daftarBenda, lensaDari, rapikanLED, susunanLED,
  sesuaikanUkuranRuang, sinarProyektor, templateRuang, throwRatioDari, ukuranGambarDisplay, type Benda, type Blending, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { hitungLED, MODUL_LED, ukuranDariDiagonal } from '../lib/av-hitung';

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

console.log('\n7. Proyektor tertanam di plafon / dinding (hanya lensa di dalam ruang)');
{
  const p0 = bendaBaru('proyektor', k3, { pasangProyektor: 'plafon' });
  const lensa = (b: Benda) => keDunia(b, lensaProyektor(b));
  const m = JARAK_LENSA_PERMUKAAN;
  //  Diangkat jauh ke atas plafon: badan menembus plafon, lensa berhenti 3 cm di bawah plafon.
  const naik = { ...p0, ...jepitProyektor({ ...p0, elev: 9 }, k3.p, k3.l, k3.t) };
  cek(`plafon 3 m: badan tertanam (puncak ${(naik.elev + naik.h).toFixed(2)} m), lensa ${lensa(naik)[1].toFixed(3)} m = 3 cm di bawah plafon`,
    naik.elev + naik.h > k3.t && Math.abs(lensa(naik)[1] - (k3.t - m)) < 1e-9);
  //  Didorong menembus dinding belakang (menghadap layar di depan): lensa tetap 3 cm di dalam ruang.
  const mundur = { ...p0, rot: 180, z: 20 };
  const j = { ...mundur, ...jepitProyektor(mundur, k3.p, k3.l, k3.t) };
  cek(`dinding belakang: badan masuk dinding (tepi ${(j.z + j.d / 2).toFixed(2)} > ${k3.l} m), lensa ${lensa(j)[2].toFixed(3)} m`,
    j.z + j.d / 2 > k3.l && Math.abs(lensa(j)[2] - (k3.l - m)) < 1e-9);
  const dlm = jepitProyektor({ ...p0, x: 4, z: 3, elev: 2 }, k3.p, k3.l, k3.t);
  cek('posisi di dalam ruang tidak diubah', dlm.x === 4 && dlm.z === 3 && dlm.elev === 2);
  const mesin = readFileSync(`${D3}/mesin/useMesin.ts`, 'utf8');
  cek('seret (gizmo): proyektor dijepit lewat lensanya, benda lain tetap utuh di dalam ruang',
    /jepitProyektor\(\{ \.\.\.b0, x, z, rot, elev: Math\.max\(0, o\.position\.y\) \}, bt\.x, bt\.z, plafon\)/.test(mesin) && /proyektor \? v : Math\.min\(bt\.x, Math\.max\(0, v\)\)/.test(mesin));
  cek('geser cepat & input angka (X, Z, Dari lantai) memakai aturan yang sama',
    /jepitProyektor\(/.test(readFileSync(`${D3}/panel/GeserCepat.tsx`, 'utf8')) && (readFileSync(`${D3}/panel/benda/BagianUmum.tsx`, 'utf8').match(/posisiProyektor\(\{/g) ?? []).length === 3);
  //  Ubah ukuran ruang: proyektor tertanam yang menembak layar tetap tertanam (tidak dipasang ulang ke drop pole).
  const layar = bendaBaru('layar', k3, { diag: 100 });
  const pas = proyektorKeLayar(p0, layar, k3, r3);
  const tanam = { ...pas, elev: Math.round((k3.t - pas.h + 0.03) * 100) / 100 }; //  badan menembus 3 cm, lensa tetap di bawah plafon
  const r4 = { ...r3, p: 9 };
  const hasil = sesuaikanUkuranRuang([layar, tanam], r3, r4).find(b => b.jenis === 'proyektor')!;
  cek('ruang dipanjangkan: proyektor tertanam tetap tertanam & lensanya di bawah plafon', hasil.elev === tanam.elev && lensa(hasil)[1] <= r4.t - m + 1e-9, `elev ${hasil.elev}`);
}

console.log('\n8. Keterangan blending tidak mengganggu');
{
  const ukur = readFileSync(`${D3}/mesin/ukurBlending.ts`, 'utf8');
  const keadaan = readFileSync(`${D3}/useKeadaanDesain.ts`, 'utf8');
  cek('bawaan tersembunyi & diingat per perangkat', /localStorage\.getItem\('wm_desain3d_detail_blending'\) === '1'/.test(keadaan));
  cek('zona & angka cm tetap tampil; kartu, garis penunjuk & titiknya disembunyikan lewat .visible', !/if \(!detail\) return;/.test(ukur) && /objKartu\.visible = buka; penunjuk\.visible = buka; titikTengah\.visible = buka;/.test(ukur));
  cek('klik ⓘ di angka cm / klik kartu = buka / tutup satu area (bertahan saat digambar ulang)', /angka\.append\(cm, ikon\)/.test(ukur) && /pilihanKartu\.set\(kunci, buka\)/.test(ukur) && /for \(const el of \[angka, kartu\]\)/.test(ukur));
  cek('lembar cetak menulis angka tanpa ⓘ', /angka\.dataset\.teks = cm/.test(ukur));
  cek('centang bernama "Keterangan blending"', /l: 'Keterangan blending'/.test(readFileSync(`${D3}/panel/KontrolKanvas.tsx`, 'utf8')));
}

console.log('\n9. Resolusi asli proyektor (16:9 / 16:10 / 4:3)');
{
  const r: Ruang = { p: 8, l: 8, t: 3.2, lantai: 'kayu', r2: null };
  const k = daftarRuang(r)[0];
  for (const [res, rasio] of [['FHD', 9 / 16], ['WUXGA', 10 / 16], ['4K', 9 / 16], ['XGA', 3 / 4]] as const) {
    const l = bendaBaru('layar', k, { diag: 100, rasio: '16:10' } as Partial<Benda>);
    const p = proyektorKeLayar({ ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), resolusiProyektor: res }, l, k, r);
    const sn = sinarProyektor(p, [l, p], r);
    const c = cakupanProyektor([p], permukaanBenda(l));
    cek(`${res}: tinggi gambar = lebar x ${rasio.toFixed(4)} (sinar, lensa blending), layar 16:10 tertutup ${pr(c.tertutup)}`,
      Math.abs(sn.tinggi / sn.lebar - rasio) < 1e-9 && Math.abs(lensaDari(p).h1 / lensaDari(p).w1 - rasio) < 1e-9 && c.tertutup >= 0.99,
      `${sn.lebar.toFixed(2)} x ${sn.tinggi.toFixed(2)}`);
  }
  const b: Blending = { a: 'a', b: 'b', namaA: 'P1', namaB: 'P2', arah: 'atas-bawah', lebarM: 0.5, persenA: 10, persenB: 10, tengah: [0, 0, 0], garis: [], pxA: 1200, pxB: 1080 };
  cek('piksel blending dari resolusi tiap proyektor (WUXGA 10% tinggi = 120 px, Full HD = 108 px)', barisKeterangan(b)[2] === 'P1: 10% ≈ 120 px · P2: 10% ≈ 108 px' && barisKeterangan(b)[3] === 'dari tinggi gambar (1200 / 1080 px)');
}

console.log('\n10. LED: unit utuh & referensi menu LED Videotron');
{
  const led = bendaBaru('led', k3);
  const s = susunanLED(led);
  cek(`bawaan: ${s.kolom} x ${s.baris} cabinet 500 mm = ${led.w} x ${led.h} m (kelipatan cabinet utuh)`, led.w === s.kolom * 0.5 && led.h === s.baris * 0.5);
  const lama = rapikanLED([{ ...led, w: 4, h: 2.25 }])[0];
  cek(`desain lama 4 x 2,25 m (4,5 baris) dirapikan saat dibuka -> ${lama.w} x ${lama.h} m`, Number.isInteger(Math.round(lama.h / 0.5 * 1e6) / 1e6) && Number.isInteger(Math.round(lama.w / 0.5 * 1e6) / 1e6));
  //  Sama persis dengan hitungLED alat LED Videotron untuk modul referensi (piksel dari datasheet, bukan ukuran/pitch).
  const m = MODUL_LED.find(x => x.kode === 'P1.86')!;
  const ref = { ...led, satuanLED: 'referensi' as const, unitLED: 'modul' as const, pitch: m.pitch, cabW: m.w, cabH: m.h, pxUnitX: m.pxW, pxUnitY: m.pxH, w: 4.5, h: 2.5 };
  const sr = susunanLED(ref);
  const h = hitungLED({ pitch: m.pitch, cabLebar: m.w, cabTinggi: m.h, kolom: sr.kolom, baris: sr.baris, pxX: m.pxW, pxY: m.pxH, dayaMaksCab: 1, faktorRata: 0.3, beratCab: 1, refresh: 60, bit: 8, tegangan: 220 });
  cek(`modul P1.86 320 x 160 (172 x 86 px): ${sr.kolom} x ${sr.baris} modul, ${sr.resX} x ${sr.resY} px = hitungLED alat LED Videotron`,
    sr.resX === h.resX && sr.resY === h.resY && Math.abs(sr.lebarM - h.lebarM) < 1e-9 && Math.abs(sr.tinggiM - h.tinggiM) < 1e-9 && sr.unit === 'modul');
  const src = readFileSync(`${D3}/panel/benda/AturLED.tsx`, 'utf8');
  cek('panel LED memakai referensi & daftar cabinet / pitch menu LED Videotron', /useReferensiLED\(\)/.test(src) && /from '\.\.\/\.\.\/\.\.\/led\/data'/.test(src) && /'referensi'/.test(src));
}

console.log('\n11. BOM: videowall per panel, LED per unit');
{
  const vw = bendaBaru('videowall', k3);
  const led = bendaBaru('led', k3);
  const d = daftarBenda([vw, led]);
  const bVw = d.find(x => x.item === vw.nama)!, bLed = d.find(x => x.item === led.nama)!;
  cek(`videowall 2 x 2 = ${bVw.jumlah} ${bVw.satuan} (dulu "1 unit")`, bVw.jumlah === 4 && bVw.satuan === 'panel');
  cek(`LED 9 x 5 = ${bLed.jumlah} ${bLed.satuan} (dulu "1 unit")`, bLed.jumlah === 45 && bLed.satuan === 'cabinet' && /1800 × 1000 px/.test(bLed.catatan));
  cek('BOM lengkap memakai jumlah yang sama', bomDesain([vw, led], []).find(x => x.item === vw.nama)!.jumlah === 4);
}

console.log('\n12. Objek lain: tinggi pasang kamera');
{
  for (const t of ['ptz', 'ptz-ai', 'xbar'] as const) {
    const kam = bendaBaru('kamera', k3, { tipeKamera: t });
    cek(`kamera ${t}: ${kam.elev} m dari lantai (dekat tinggi mata, bukan 0,4 m)`, kam.elev >= 0.8 && kam.elev <= 2.2);
  }
  const contoh = contohAwal(r3), vw = contoh.find(b => b.jenis === 'videowall')!, kam = contoh.find(b => b.jenis === 'kamera')!;
  cek(`ruang meeting contoh: kamera di atas videowall (${kam.elev} m >= ${(vw.elev + vw.h).toFixed(2)} m), bukan di bawahnya`, kam.elev >= vw.elev + vw.h);
}

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
