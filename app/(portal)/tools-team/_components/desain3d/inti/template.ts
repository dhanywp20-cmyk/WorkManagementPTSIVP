/** Template kategori ruangan siap pakai (dipisah dari model.ts). */
import { bendaBaru, contohAwal, setRuangKelas } from './katalog';
import { LENSA_MZ882, type LensaPanasonic, lensaMZ882 } from './lensaPanasonic';
import { lengkungDari } from './produk';
import { arahkanKe, keDunia, lensaProyektor } from './proyektor';
import { daftarRuang } from './ruang';
import type { Benda, Kotak, Ruang, Titik } from './tipe';

// ── Kategori ruangan (template siap pakai) ─────────────────────────────────

export type KategoriRuang = 'meeting' | 'auditorium' | 'kelas' | 'control-room' | 'mapping-lengkung' | 'mapping-cembung' | 'mapping-objek' | 'immersive';
export const KATEGORI_RUANG: { id: KategoriRuang; judul: string; ket: string; ikon: string }[] = [
  { id: 'meeting', judul: 'Ruangan Meeting', ket: 'Videowall, meja rapat, kamera, mic & speaker plafon', ikon: '🤝' },
  { id: 'auditorium', judul: 'Auditorium', ket: 'Panggung, LED videotron, line array, podium & tribun bertingkat', ikon: '🎭' },
  { id: 'control-room', judul: 'Control room', ket: 'Videowall 4 × 3 (grafik + CCTV), meja operator multi monitor, rack server, kredensa', ikon: '🖥️' },
  { id: 'kelas', judul: 'Smart Classroom', ket: 'Interactive display, meja dosen di depan, kamera tracking, meja mahasiswa', ikon: '🎓' },
  { id: 'mapping-lengkung', judul: 'Mapping - layar cekung', ket: 'Screen melengkung ke dalam + 3 proyektor blending; bentuk & warna bisa diganti', ikon: '🌙' },
  { id: 'mapping-cembung', judul: 'Mapping - layar cembung', ket: 'Screen melengkung keluar + 2 proyektor blending; bentuk & warna bisa diganti', ikon: '🏛️' },
  { id: 'mapping-objek', judul: 'Mapping - objek upload', ket: 'Alas di tengah + 3 proyektor; impor objek .glb lalu cek sinarnya', ikon: '🧩' },
  { id: 'immersive', judul: 'Immersive room', ket: 'Proyeksi 4 dinding + lantai: 5 × Panasonic PT-MZ882 + ET-ELU20 (bisa ditambah)', ikon: '🌐' },
];

/** Warna bawaan ruang mapping: abu-abu netral (bukan hitam) supaya ruang & sinar tetap terlihat. */
const ABU_DINDING = '#9ca3af', ABU_LANTAI = '#6b7280';

/**
 * Proyektor gantung plafon PT-MZ882 + lensa nyata `ln` (zoom `tr`, di dalam rentang lensa) tanpa lens shift (pusat
 * gambar = sumbu) dengan LENSA tepat di `lensa`, dibidik ke `target`. Posisi badan dihitung balik dari lensa (badan
 * ikut miring saat menunduk), jadi setelan hasil uji cakupan (inti/cakupanProyektor.ts, uji/desain3d-cakupan.ts)
 * terpasang persis. Mapping memakai tilt: gambar trapesium dikoreksi warping di media server.
 */
function proyektorKe(k: Kotak, lensa: Titik, target: Titik, ln: LensaPanasonic, tr: number, nama: string): Benda {
  const p0 = bendaBaru('proyektor', k, { pasangProyektor: 'plafon' });
  let p: Benda = { ...p0, ...lensaMZ882(ln, tr), x: lensa[0], z: lensa[2], elev: lensa[1] - p0.h / 2, offsetLensa: 0, nama };
  for (let i = 0; i < 4; i++) {
    p = arahkanKe(p, target);
    const l = keDunia(p, lensaProyektor(p));
    p = { ...p, x: p.x + lensa[0] - l[0], z: p.z + lensa[2] - l[2], elev: p.elev + lensa[1] - l[1] };
  }
  p = arahkanKe(p, target);
  return { ...p, x: Math.round(p.x * 1000) / 1000, z: Math.round(p.z * 1000) / 1000, elev: Math.round(p.elev * 1000) / 1000 };
}

/** Ruangan + isi untuk satu kategori. Semuanya tetap bisa diubah setelah dipasang. */
export function templateRuang(id: KategoriRuang): { nama: string; ruang: Ruang; benda: Benda[] } {
  if (id === 'auditorium') {
    const ruang: Ruang = { p: 16, l: 20, t: 7, lantai: 'karpet', cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const panggung = { ...bendaBaru('panggung', k), x: 8, z: 2.2, w: 11, d: 4.2, h: 0.8 };
    const led = { ...bendaBaru('led', k), x: 8, z: 0.08, w: 6.5, h: 3.5, elev: 1.6, pitch: 2.5, nama: 'LED videotron 6,5 × 3,5 m' };
    //  Kemiringan atas 6° + 2° per sambungan: sumbu ke-8 modul mendarat di telinga penonton tribun dari baris depan
    //  (z ±9,2) sampai belakang (z ±18,7) - dengan 4° modul teratas lewat di atas baris belakang & menabrak dinding.
    const la = (x: number, nama: string) => ({ ...bendaBaru('speaker', k, { tipeSpeaker: 'linearray', modul: 8 }), x, z: 1.2, rot: 0, gantung: true,
      elev: 7 - 0.6 - 2.4, tiltLA: 6, sudutModul: 2, nama });
    const tribun = bendaBaru('tribun', k, { baris: 12, kursiBaris: 18, tinggiAnak: 0.3 });
    const podium = { ...bendaBaru('meja', k, { bentukMeja: 'podium' }), x: 11.5, z: 2.6, elev: 0.8, rot: 0 };
    const kam = { ...bendaBaru('kamera', k, { tipeKamera: 'ptz' }), x: 8, z: 19.8, elev: 4.2, rot: 180 };
    return { nama: 'Auditorium', ruang, benda: [panggung, led, la(1.6, 'Line array kiri'), la(14.4, 'Line array kanan'), { ...tribun, x: 8, z: 20 - tribun.d / 2 - 0.4 }, podium, kam] };
  }
  if (id === 'kelas') {
    const ruang: Ruang = { p: 10, l: 8, t: 3.2, lantai: 'keramik', r2: null };
    const k = daftarRuang(ruang)[0];
    const ifp = { ...bendaBaru('ifp', k, { diag: 86, pasang: 'dinding' }), x: 5 };
    const signage = { ...bendaBaru('tv', k, { diag: 65, pasang: 'dinding', nama: 'Signage 65"' }), x: 8.4, elev: 1.1 };
    const dosen = { ...bendaBaru('meja', k, { bentukMeja: 'dosen' }), x: 2.2, z: 1.7, rot: 0 };
    const podium = { ...bendaBaru('meja', k, { bentukMeja: 'podium' }), x: 3.7, z: 1.4, rot: 0 };
    const mic = { ...bendaBaru('mic', k, { mic: 'gooseneck' }), x: 2.5, z: 1.6, elev: 0.75, rot: 0 };
    const tp = { ...bendaBaru('touchpanel', k), x: 1.8, z: 1.75, elev: 0.75, rot: 0 };
    const kam = { ...bendaBaru('kamera', k, { tipeKamera: 'ptz-ai' }), x: 5, z: 7.88, elev: 2.2, rot: 180, nama: 'Kamera PTZ AI (tracking dosen)' };
    const spk = [[2.5, 2.2], [7.5, 2.2], [2.5, 5.8], [7.5, 5.8]].map(([x, z]) => ({ ...bendaBaru('speaker-plafon', k), x, z }));
    const kelas = setRuangKelas(k, { kolom: 4, baris: 4, pengajar: false });
    return { nama: 'Smart Classroom', ruang, benda: [ifp, signage, dosen, podium, mic, tp, kam, ...spk, ...kelas] };
  }
  if (id === 'control-room') {
    const ruang: Ruang = { p: 10, l: 9, t: 3.4, lantai: 'karpet', cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const vw = { ...bendaBaru('videowall', k, { kol: 4, bar: 3, konten: 'campuran' }), x: 5, elev: 0.75, nama: 'Videowall 55" 4×3' };
    const kredensa = { ...bendaBaru('meja', k, { bentukMeja: 'kredensa' }), x: 5, w: Math.min(4.8, vw.w), h: 0.6, d: 0.45, z: 0.25 };
    const meja: Benda[] = [], kursi: Benda[] = [];
    for (const [z, xs] of [[4.1, [2.6, 5, 7.4]], [6.2, [2.6, 5, 7.4]]] as [number, number[]][]) {
      for (const x of xs) {
        meja.push({ ...bendaBaru('meja', k, { bentukMeja: 'operator' }), x, z, w: 1.8, monitorMeja: 4 });
        for (const dx of [-0.45, 0.45]) kursi.push({ ...bendaBaru('kursi', k, { tipeKursi: 'kantor' }), x: x + dx, z: z + 0.75, rot: 180 });
      }
    }
    const rak = [8.3, 9.0].map(x => ({ ...bendaBaru('rak', k, { rakU: 42, tipeRak: 'kaca' as const }), x, z: 8.4, rot: 180 }));
    const lampu: Benda[] = [];
    for (const x of [2.6, 5, 7.4]) for (const z of [3.2, 5.6, 7.6]) lampu.push({ ...bendaBaru('lampu', k, { tipeLampu: 'linear', dimmer: 60 }), x, z, nama: `Lampu linear ${lampu.length + 1}` });
    return { nama: 'Control room', ruang: { ...ruang, dimmer: 100 }, benda: [vw, kredensa, ...meja, ...kursi, ...rak, ...lampu] };
  }
  if (id === 'mapping-lengkung') {
    const ruang: Ruang = { p: 14, l: 12, t: 5, lantai: 'polos', warnaLantai: ABU_LANTAI, warnaDinding: ABU_DINDING, cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const bidang = { ...bendaBaru('bidang', k, { bentukBidang: 'lengkung', jariBidang: 7, busur: 100 }), x: 7, h: 3.5, elev: 0.3 };
    bidang.z = bidang.d / 2 + 0.2;
    const pusatZ = bidang.z + (7 - bidang.d / 2), yT = bidang.elev + bidang.h / 2 + 0.15;
    const titik = (deg: number): Titik => { const a = (deg * Math.PI) / 180; return [7 + 7 * Math.sin(a), yT, pusatZ - 7 * Math.cos(a)]; };
    //  Layar 3,5 m tinggi di jarak ±6 m -> lensa throw pendek: PT-MZ882 + ET-ELW22 (zoom 0,814-1,009) di TR 1,0.
    //  Lensa standar ET-ELS20 (1,639-2,788) di jarak ini hanya memberi gambar ±2,3 m tinggi. Hasil uji: tertutup >= 99%,
    //  tumpang blending tiap sambungan di rentang 10-40%.
    const proj = [-30, 0, 30].map((deg, i) => proyektorKe(k, [7 + (i - 1) * 0.8, 4.3, pusatZ - 1], titik(deg), LENSA_MZ882.ELW22, 1, `Proyektor ${i + 1} (blending)`));
    //  Sinar nyata (tanpa Mask): cahaya yang lewat tepi layar tetap jatuh ke dinding / lantai di belakangnya,
    //  makin redup dengan jarak & sudut - seperti di lokasi. Mask ke bidang tetap bisa dinyalakan di panel proyektor.
    return { nama: 'Mapping layar cekung', ruang, benda: [bidang, ...proj] };
  }
  if (id === 'mapping-cembung') {
    const ruang: Ruang = { p: 12, l: 10, t: 5, lantai: 'polos', warnaLantai: ABU_LANTAI, warnaDinding: ABU_DINDING, cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    //  Screen 6 m melengkung keluar 60 cm ke arah penonton.
    const bidang = { ...bendaBaru('bidang', k, { bentukBidang: 'cembung', ...lengkungDari(6, 0.6) }), x: 6, h: 2.2, elev: 0.8 };
    bidang.z = bidang.d / 2 + 0.5;
    const R = bidang.jariBidang ?? 5, pusatZ = bidang.z + bidang.d / 2 - R, yT = bidang.elev + bidang.h / 2;
    const titik = (deg: number, y = yT): Titik => { const a = (deg * Math.PI) / 180; return [6 + R * Math.sin(a), y, pusatZ + R * Math.cos(a)]; };
    //  Tiap proyektor membidik separuh layarnya (±10° busur), sedikit di atas tengah: proyektor plafon menunduk
    //  -> gambar trapesium & ujung layar cembung lebih jauh, jadi tanpa ini pita atas layar tidak tersinari.
    //  Hasil uji: tertutup >= 99%, tumpang ±17%; ±15% cahaya jatuh di luar layar (wajib di-mask di media server).
    //  PT-MZ882 + ET-ELW20 (zoom 1,245-1,695) di TR 1,55.
    const proj = [-1, 1].map((s, i) => proyektorKe(k, [6 + s * 1.9, 4.3, 6.2], titik(s * 10, yT + 0.1), LENSA_MZ882.ELW20, 1.55, `Proyektor ${i + 1} (blending)`));
    return { nama: 'Mapping layar cembung', ruang, benda: [bidang, ...proj] };
  }
  if (id === 'mapping-objek') {
    const ruang: Ruang = { p: 12, l: 10, t: 5, lantai: 'polos', warnaLantai: ABU_LANTAI, warnaDinding: ABU_DINDING, cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const alas = { ...bendaBaru('panggung', k), nama: 'Alas objek', x: 6, z: 5, w: 1.8, d: 1.8, h: 0.4 };
    //  Tiga proyektor melingkar 4 m dari objek, lensa 3,6 m, membidik 1,0 m: sisi objek setinggi 1,6 m di atas alas
    //  tersinari sampai bawah (dari 4,2 m & bidik 1,2 m bagian bawah sisi objek tidak kena).
    const proj = [0, 120, 240].map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      //  PT-MZ882 + ET-ELW20 di TR 1,39 (zoom 1,245-1,695).
      return proyektorKe(k, [6 + 4 * Math.sin(a), 3.6, 5 + 4 * Math.cos(a)], [6, 1, 5], LENSA_MZ882.ELW20, 1.39, `Proyektor ${i + 1}`);
    });
    return { nama: 'Mapping objek', ruang, benda: [alas, ...proj] };
  }
  if (id === 'immersive') {
    //  Ruang 6 x 6 x 3,5 m, semua PT-MZ882 + ET-ELU20 (ultra short throw, zoom 0,338-0,364, lens shift V ±50%):
    //  - dinding: lensa 2,05 m dari dinding itu sendiri, zoom terlebar -> gambar 6,15 x 3,84 m (16:10) menutup dinding
    //    6 x 3,5 m dengan ±7 cm sisa di tiap sisi; badan rapat di plafon, lens shift ±43% menurunkan pusat gambar ke
    //    1,75 m (masih di dalam batas 50%). Keempat proyektor tidak menghalangi sinar satu sama lain.
    //  - lantai: SATU proyektor tegak ke bawah dari plafon. Dari ±3,3 m lensa ini memberi gambar ±9,7 x 6,06 m - menutup
    //    lantai 6 x 6 m; kelebihannya jatuh ke kaki dinding kiri-kanan (±1,2 m) dan wajib di-mask di media server.
    //    Dua ET-ELW22 (gambar ±4,1 x 2,6 m) tidak cukup untuk lantai ini; resolusi lebih tinggi = 6 x ET-ELW22 (3 x 2).
    //  Dulu: UST karangan TR 0,25 (tidak ada lensa Panasonic MZ seperti itu) & lantai TR 0,5-0,65.
    const ruang: Ruang = { p: 6, l: 6, t: 3.5, lantai: 'polos', warnaLantai: '#e5e7eb', warnaDinding: '#f8fafc', cahaya: 'gelap', r2: null };
    const k = daftarRuang(ruang)[0];
    const ELU = LENSA_MZ882.ELU20;
    /** Proyektor plafon dengan LENSA tepat di (x, z). */
    const diLensa = (atur: Partial<Benda>, x: number, z: number): Benda => {
      const p0 = { ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), x: 0, z: 0, ...lensaMZ882(ELU, ELU.trMin), ...atur } as Benda;
      const l = keDunia(p0, lensaProyektor(p0));
      return { ...p0, x: Math.round((x - l[0]) * 1000) / 1000, z: Math.round((z - l[2]) * 1000) / 1000 };
    };
    const tinggiBadan = bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }).h;
    const JARAK = 2.05, elev = ruang.t - tinggiBadan - 0.02;
    //  Lebar gambar di zoom terlebar: (L + b) / TR; lens shift = (tinggi lensa - 1,75) / tinggi gambar.
    const tinggiGambar = (JARAK + ELU.koreksiJarak) / ELU.trMin / 1.6;
    const offset = Math.round(((elev + tinggiBadan / 2 - ruang.t / 2) / tinggiGambar) * 1000) / 1000;
    const dinding = (rot: number, x: number, z: number, nama: string) =>
      diLensa({ elev, rot, tilt: 0, offsetLensa: offset, nama: `PT-MZ882 ${nama}` }, x, z);
    const lantai0 = diLensa({ elev: 3.3, rot: 0, tilt: -90, offsetLensa: 0, nama: 'PT-MZ882 lantai' }, 3, 3);
    //  Zoom lantai: sisi pendek gambar (16:10) >= 6,06 m dari tinggi lensanya - dijepit ke rentang lensa.
    const tinggiLensa = keDunia(lantai0, lensaProyektor(lantai0))[1];
    const trLantai = Math.round(Math.min(ELU.trMax, Math.max(ELU.trMin, (tinggiLensa + ELU.koreksiJarak) / (6.06 * 1.6))) * 10000) / 10000;
    const hasil: Benda[] = [
      dinding(180, 3, JARAK, 'dinding depan'), dinding(0, 3, ruang.l - JARAK, 'dinding belakang'),
      dinding(270, JARAK, 3, 'dinding kiri'), dinding(90, ruang.p - JARAK, 3, 'dinding kanan'),
      { ...lantai0, throwRatio: trLantai },
    ];
    hasil.forEach((p, i) => { p.nama = `${p.nama} ${i + 1}`; });
    return { nama: 'Immersive room', ruang, benda: hasil };
  }
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  return { nama: 'Ruang Meeting', ruang, benda: contohAwal(ruang) };
}
