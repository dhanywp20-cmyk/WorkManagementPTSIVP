/** Template kategori ruangan siap pakai (dipisah dari model.ts). */
import { bendaBaru, contohAwal, setRuangKelas } from './katalog';
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
  { id: 'immersive', judul: 'Immersive room', ket: 'Proyeksi 4 dinding + lantai: 4 proyektor UST dinding & 2 lantai (bisa ditambah)', ikon: '🌐' },
];

/** Warna bawaan ruang mapping: abu-abu netral (bukan hitam) supaya ruang & sinar tetap terlihat. */
const ABU_DINDING = '#9ca3af', ABU_LANTAI = '#6b7280';

/**
 * Proyektor gantung plafon tanpa lens shift (pusat gambar = sumbu) dengan LENSA tepat di `lensa`, dibidik ke
 * `target`. Posisi badan dihitung balik dari lensa (badan ikut miring saat menunduk), jadi setelan hasil uji
 * cakupan (inti/cakupanProyektor.ts, uji/desain3d-cakupan.ts) terpasang persis.
 */
function proyektorKe(k: Kotak, lensa: Titik, target: Titik, tr: number, nama: string, zoom: [number, number] = [tr, tr]): Benda {
  const p0 = bendaBaru('proyektor', k, { pasangProyektor: 'plafon' });
  let p: Benda = { ...p0, x: lensa[0], z: lensa[2], elev: lensa[1] - p0.h / 2, offsetLensa: 0, throwRatio: tr, trMin: zoom[0], trMax: zoom[1], nama };
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
    const la = (x: number, nama: string) => ({ ...bendaBaru('speaker', k, { tipeSpeaker: 'linearray', modul: 8 }), x, z: 1.2, rot: 0, gantung: true,
      elev: 7 - 0.6 - 2.4, tiltLA: 4, sudutModul: 2, nama });
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
    //  Layar 3,5 m tinggi: gambar 16:9 harus >= 3,5 m tinggi di jarak ±6 m -> lensa throw pendek (TR 1,0, zoom 0,9-1,1).
    //  Dengan lensa standar 1,39-2,09 tinggi gambar maks 2,8 m (layar hanya tertutup ±75%). Hasil uji: tertutup >= 99%,
    //  tumpang blending ±33% (tiap sambungan).
    const proj = [-30, 0, 30].map((deg, i) => proyektorKe(k, [7 + (i - 1) * 0.8, 4.3, pusatZ - 1], titik(deg), 1, `Proyektor ${i + 1} (blending)`, [0.9, 1.1]));
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
    const proj = [-1, 1].map((s, i) => proyektorKe(k, [6 + s * 1.9, 4.3, 6.2], titik(s * 10, yT + 0.1), 1.55, `Proyektor ${i + 1} (blending)`, [1.39, 2.09]));
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
      return proyektorKe(k, [6 + 4 * Math.sin(a), 3.6, 5 + 4 * Math.cos(a)], [6, 1, 5], 1.39, `Proyektor ${i + 1}`, [1.39, 2.09]);
    });
    return { nama: 'Mapping objek', ruang, benda: [alas, ...proj] };
  }
  if (id === 'immersive') {
    //  Ruang 6 x 6 x 3,5 m. Tiap dinding disorot satu proyektor ultra short throw (TR 0,25) yang
    //  digantung 1,5 m dari dinding itu sendiri - gambar 6 x 3,375 m dan tidak terhalang proyektor lain.
    //  Offset 46%: gambar naik sedikit sampai plafon (offset 50% menyisakan pita ±13 cm di atas yang gelap). Lantai: dua proyektor tegak ke bawah, lens shift 12% ke luar
    //  supaya keduanya menutup lantai dengan area blending di tengah.
    const ruang: Ruang = { p: 6, l: 6, t: 3.5, lantai: 'polos', warnaLantai: '#e5e7eb', warnaDinding: '#f8fafc', cahaya: 'gelap', r2: null };
    const k = daftarRuang(ruang)[0];
    /** Proyektor plafon dengan LENSA tepat di (x, z). */
    const diLensa = (atur: Partial<Benda>, x: number, z: number): Benda => {
      const p0 = { ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), x: 0, z: 0, ...atur } as Benda;
      const l = keDunia(p0, lensaProyektor(p0));
      return { ...p0, x: Math.round((x - l[0]) * 1000) / 1000, z: Math.round((z - l[2]) * 1000) / 1000 };
    };
    const ust = (rot: number, x: number, z: number, nama: string) =>
      diLensa({ elev: 3.3, rot, tilt: 0, offsetLensa: 0.46, throwRatio: 0.25, trMin: 0.25, trMax: 0.25, nama: `UST ${nama}` }, x, z);
    const lantai = (rot: number, z: number) =>
      diLensa({ elev: 3.3, rot, tilt: -90, offsetLensa: 0.12, throwRatio: 0.54, trMin: 0.5, trMax: 0.65, nama: 'Lantai' }, 3, z);
    const hasil: Benda[] = [
      ust(180, 3, 1.5, 'dinding depan'), ust(0, 3, 4.5, 'dinding belakang'), ust(270, 1.5, 3, 'dinding kiri'), ust(90, 4.5, 3, 'dinding kanan'),
      lantai(0, 2), lantai(180, 4),
    ];
    hasil.forEach((p, i) => { p.nama = `${p.nama} ${i + 1}`; });
    return { nama: 'Immersive room', ruang, benda: hasil };
  }
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  return { nama: 'Ruang Meeting', ruang, benda: contohAwal(ruang) };
}
