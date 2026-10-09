/**
 * desain3d/inti/katalog.ts - Katalog "Tambah benda", pembuat benda baru (ukuran & posisi awal), set ruang kelas, dan utilitas benda.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
import { setLampuGrid, SPEK_LAMPU } from './cahaya';
import { SPEK_PERANGKAT } from './perangkat';
import { kursiTribun, spekVideowall, terapkanUkuran } from './produk';
import { daftarRuang } from './ruang';
import { type Benda, type BentukObjek, CELAH_PASANG, type Jenis, type Kotak, LABEL, LABEL_BENTUK_OBJEK, pasangDari, type Ruang } from './tipe';

export interface ItemKatalog {
  kunci: string; label: string; ket: string; jenis: Jenis; atur?: Partial<Benda>;
  /** Preset beberapa benda sekaligus (mis. set ruang kelas) - menggantikan satu benda `jenis`. */
  set?: (k: Kotak) => Benda[];
}
export const KATALOG: { grup: string; item: ItemKatalog[] }[] = [
  {
    grup: 'Display', item: [
      { kunci: 'vw55', label: 'Videowall 55"', ket: 'Philips 55BDL2105X · 2×2', jenis: 'videowall', atur: { vw: '55BDL2105X', kol: 2, bar: 2 } },
      { kunci: 'vw49', label: 'Videowall 49"', ket: 'Philips 49BDL2105X · 2×2', jenis: 'videowall', atur: { vw: '49BDL2105X', kol: 2, bar: 2 } },
      { kunci: 'led', label: 'LED Videotron', ket: 'Pitch & cabinet bebas', jenis: 'led' },
      { kunci: 'layar', label: 'Layar proyektor', ket: '100" / 120" / 200" · 16:9 / 4:3', jenis: 'layar' },
      { kunci: 'proj', label: 'Proyektor plafon', ket: 'Bracket gantung · sinar ke layar', jenis: 'proyektor', atur: { pasangProyektor: 'plafon' } },
      { kunci: 'proj-m', label: 'Proyektor portabel', ket: 'Diletakkan di meja · sinar ke layar', jenis: 'proyektor', atur: { pasangProyektor: 'meja' } },
      { kunci: 'ifp-d', label: 'Interactive display', ket: '65" / 75" / 86" · dinding', jenis: 'ifp', atur: { pasang: 'dinding' } },
      { kunci: 'ifp-s', label: 'Interactive standfloor', ket: '65" / 75" / 86" · troli', jenis: 'ifp', atur: { pasang: 'standfloor' } },
      { kunci: 'signage', label: 'Signage display', ket: '55" / 65" / 75" / 86" · bracket dinding', jenis: 'tv', atur: { diag: 55, pasang: 'dinding', nama: 'Signage 55"' } },
      { kunci: 'signage-s', label: 'Signage standfloor', ket: '55" - 86" · stand beroda', jenis: 'tv', atur: { diag: 65, pasang: 'standfloor', nama: 'Signage 65"' } },
      { kunci: 'signage-h', label: 'Signage + struktur hollow', ket: '55" - 86" · wall bracket di rangka hollow', jenis: 'tv', atur: { diag: 65, pasang: 'hollow', nama: 'Signage 65"' } },
      { kunci: 'tv', label: 'TV / Display', ket: 'Diagonal bebas', jenis: 'tv' },
    ],
  },
  {
    grup: 'Audio & kontrol', item: [
      { kunci: 'mic-g', label: 'Mic gooseneck', ket: 'Di meja', jenis: 'mic', atur: { mic: 'gooseneck' } },
      { kunci: 'mic-b', label: 'Mic boundary', ket: 'Di meja · cakram bundar', jenis: 'mic', atur: { mic: 'boundary' } },
      { kunci: 'spk6', label: 'Speaker dinding 6"', ket: 'Kabinet membulat + bracket putar', jenis: 'speaker', atur: { tipeSpeaker: 'dinding6' } },
      { kunci: 'spk', label: 'Speaker dinding kotak', ket: 'Kabinet + bracket dinding', jenis: 'speaker', atur: { tipeSpeaker: 'kotak' } },
      { kunci: 'spk-kolom', label: 'Speaker portable aktif', ket: 'Kolom + subwoofer, berdiri di lantai', jenis: 'speaker', atur: { tipeSpeaker: 'kolom' } },
      { kunci: 'spk-la', label: 'Line array', ket: 'Modul bertumpuk / digantung, jumlah modul bebas', jenis: 'speaker', atur: { tipeSpeaker: 'linearray' } },
      { kunci: 'spk-p', label: 'Speaker plafon', ket: 'In-ceiling, gril bulat', jenis: 'speaker-plafon' },
      { kunci: 'tp', label: 'Touch panel', ket: 'Kontrol di meja', jenis: 'touchpanel' },
      { kunci: 'rak', label: 'Rack server (pintu kaca)', ket: '12U - 42U, isi perangkat terlihat', jenis: 'rak', atur: { tipeRak: 'kaca' } },
      { kunci: 'rak-tutup', label: 'Rack server tertutup', ket: 'Pintu besi berlubang', jenis: 'rak', atur: { tipeRak: 'tertutup' } },
      { kunci: 'rak-open', label: 'Rack open frame', ket: 'Tanpa pintu & panel samping', jenis: 'rak', atur: { tipeRak: 'open' } },
    ],
  },
  {
    grup: 'Kamera & konferensi', item: [
      { kunci: 'kam', label: 'Kamera PTZ', ket: 'Pan-tilt-zoom, di dinding/rak', jenis: 'kamera', atur: { tipeKamera: 'ptz' } },
      { kunci: 'kam-ai', label: 'Kamera PTZ AI', ket: 'Auto-tracking, bar sensor', jenis: 'kamera', atur: { tipeKamera: 'ptz-ai' } },
      { kunci: 'xbar', label: 'Camera soundbar', ket: 'Video bar: kamera + speaker + mic', jenis: 'kamera', atur: { tipeKamera: 'xbar' } },
      { kunci: 'lift', label: 'Paperless display lift', ket: 'Layar naik dari meja + mic', jenis: 'lift' },
    ],
  },
  {
    //  Sumber presentasi. Dongle, HP, tablet & laptop + dongle = share NIRKABEL ke display (tanpa kabel ke rack).
    grup: 'Perangkat & share nirkabel', item: [
      { kunci: 'pc', label: 'PC desktop', ket: SPEK_PERANGKAT.pc.ket, jenis: 'perangkat', atur: { tipePerangkat: 'pc' } },
      { kunci: 'laptop', label: 'Laptop', ket: 'Laptop 14" terbuka di meja', jenis: 'perangkat', atur: { tipePerangkat: 'laptop' } },
      { kunci: 'laptop-dongle', label: 'Laptop + dongle WyreStorm', ket: 'Dongle USB-C tertancap · share nirkabel ke display', jenis: 'perangkat', atur: { tipePerangkat: 'laptop', pakaiDongle: true } },
      { kunci: 'dongle', label: 'Dongle WyreStorm', ket: SPEK_PERANGKAT.dongle.ket, jenis: 'perangkat', atur: { tipePerangkat: 'dongle' } },
      { kunci: 'hp', label: 'HP / smartphone', ket: SPEK_PERANGKAT.hp.ket, jenis: 'perangkat', atur: { tipePerangkat: 'hp' } },
      { kunci: 'tablet', label: 'Tablet', ket: SPEK_PERANGKAT.tablet.ket, jenis: 'perangkat', atur: { tipePerangkat: 'tablet' } },
    ],
  },
  {
    grup: 'Interior & pencahayaan', item: [
      { kunci: 'lampu-down', label: 'Downlight', ket: 'Lampu plafon bulat ±1000 lm, sinar 60°', jenis: 'lampu', atur: { tipeLampu: 'downlight' } },
      { kunci: 'lampu-spot', label: 'Spotlight', ket: 'Sinar sempit 36°, aksen', jenis: 'lampu', atur: { tipeLampu: 'spot' } },
      { kunci: 'lampu-panel', label: 'Panel LED 60 × 60', ket: 'Lampu kantor ±3600 lm, sinar lebar', jenis: 'lampu', atur: { tipeLampu: 'panel' } },
      { kunci: 'lampu-linear', label: 'Lampu linear gantung', ket: 'Pendant linear 1,2 m, kabel gantung', jenis: 'lampu', atur: { tipeLampu: 'linear' } },
      { kunci: 'lampu-gantung', label: 'Lampu gantung dekoratif', ket: 'Pendant kap kubah 42 cm, 3000 K hangat (lobi, meja rapat)', jenis: 'lampu', atur: { tipeLampu: 'gantung' } },
      { kunci: 'set-lampu', label: 'Set downlight (grid)', ket: 'Downlight merata ±2,2 m di seluruh plafon', jenis: 'lampu', set: k => setLampuGrid(k) },
    ],
  },
  {
    grup: 'Furnitur', item: [
      { kunci: 'meja', label: 'Meja rapat', ket: 'Sudut membulat, kaki panel', jenis: 'meja', atur: { bentukMeja: 'rapat' } },
      { kunci: 'meja-bulat', label: 'Meja bundar', ket: 'Meeting room kecil, kaki tunggal', jenis: 'meja', atur: { bentukMeja: 'bulat' } },
      { kunci: 'meja-kelas', label: 'Meja kelas', ket: 'Meja siswa 2 orang', jenis: 'meja', atur: { bentukMeja: 'kelas' } },
      { kunci: 'set-kelas', label: 'Set ruang kelas', ket: 'Deret meja & kursi siswa + meja pengajar', jenis: 'meja', set: k => setRuangKelas(k) },
      { kunci: 'kursi', label: 'Kursi kantor', ket: 'Beroda, sandaran melengkung', jenis: 'kursi', atur: { tipeKursi: 'kantor' } },
      { kunci: 'kursi-kelas', label: 'Kursi kelas', ket: 'Empat kaki, cangkang plastik', jenis: 'kursi', atur: { tipeKursi: 'kelas' } },
      { kunci: 'meja-dosen', label: 'Meja dosen', ket: 'Meja pengajar berpanel depan', jenis: 'meja', atur: { bentukMeja: 'dosen' } },
      { kunci: 'podium', label: 'Podium', ket: 'Mimbar + mic gooseneck', jenis: 'meja', atur: { bentukMeja: 'podium' } },
      { kunci: 'kredensa', label: 'Kredensa', ket: 'Lemari rendah di bawah display', jenis: 'meja', atur: { bentukMeja: 'kredensa' } },
      { kunci: 'meja-operator', label: 'Meja operator', ket: 'Control room, multi monitor', jenis: 'meja', atur: { bentukMeja: 'operator' } },
    ],
  },
  {
    grup: 'Venue & mapping', item: [
      { kunci: 'tribun', label: 'Tribun', ket: 'Kursi teater bertingkat, baris & kursi bebas', jenis: 'tribun' },
      { kunci: 'panggung', label: 'Panggung', ket: 'Platform + tangga', jenis: 'panggung' },
      { kunci: 'bidang-datar', label: 'Layar mapping datar', ket: 'Bidang screen datar, lebar & tinggi bebas', jenis: 'bidang', atur: { bentukBidang: 'datar' } },
      { kunci: 'bidang-lengkung', label: 'Layar mapping cekung', ket: 'Screen melengkung ke dalam (curve), lebar & kedalaman lengkung bebas', jenis: 'bidang', atur: { bentukBidang: 'lengkung' } },
      { kunci: 'bidang-cembung', label: 'Layar mapping cembung', ket: 'Screen melengkung keluar ke arah penonton', jenis: 'bidang', atur: { bentukBidang: 'cembung', busur: 60, jariBidang: 5 } },
      { kunci: 'pilar', label: 'Pilar mapping 360°', ket: 'Silinder untuk mapping keliling', jenis: 'bidang', atur: { bentukBidang: 'cembung', busur: 360, jariBidang: 0.8 } },
    ],
  },
  {
    //  Bentuk dasar untuk menyusun objek mapping sendiri (gedung = balok + prisma atap, tugu = silinder + kerucut, dst.).
    grup: 'Objek mapping - bentuk dasar', item: [
      { kunci: 'objek-kotak', label: 'Kotak / balok', ket: 'Gedung, podium, kubus mapping', jenis: 'objek', atur: { bentukObjek: 'kotak' } },
      { kunci: 'objek-silinder', label: 'Silinder', ket: 'Tugu, tiang, tabung', jenis: 'objek', atur: { bentukObjek: 'silinder' } },
      { kunci: 'objek-bola', label: 'Bola', ket: 'Globe / bola mapping', jenis: 'objek', atur: { bentukObjek: 'bola' } },
      { kunci: 'objek-kubah', label: 'Kubah', ket: 'Setengah bola - kubah, dome', jenis: 'objek', atur: { bentukObjek: 'kubah' } },
      { kunci: 'objek-kerucut', label: 'Kerucut', ket: 'Puncak tugu, tumpeng', jenis: 'objek', atur: { bentukObjek: 'kerucut' } },
      { kunci: 'objek-piramida', label: 'Piramida', ket: 'Alas persegi, 4 sisi miring', jenis: 'objek', atur: { bentukObjek: 'piramida' } },
      { kunci: 'objek-prisma', label: 'Prisma segitiga', ket: 'Atap pelana, bidang miring', jenis: 'objek', atur: { bentukObjek: 'prisma' } },
    ],
  },
];
/** Ukuran awal objek mapping (m): lebar, tinggi, tebal. */
const UKURAN_OBJEK: Record<BentukObjek, [number, number, number]> = {
  kotak: [1.2, 1.2, 1.2], silinder: [0.8, 1.8, 0.8], bola: [1.2, 1.2, 1.2], kubah: [1.6, 0.8, 1.6], kerucut: [1, 1.5, 1],
  piramida: [1.4, 1.2, 1.4], prisma: [1.6, 0.8, 1.2], gambar: [1, 2, 0.3],
};
/**
 * Tinggi permukaan atas alas di titik (x, z): panggung / alas / meja yang tapaknya memuat titik itu
 * (rotasi diperhitungkan). 0 = lantai. Objek & model impor baru diletakkan di atasnya, bukan terbenam.
 */
export function tinggiAlasDi(benda: Benda[], x: number, z: number, kecuali?: string): number {
  let tinggi = 0;
  for (const b of benda) {
    if (b.id === kecuali || !['panggung', 'meja', 'objek'].includes(b.jenis)) continue;
    const r = (b.rot * Math.PI) / 180, dx = x - b.x, dz = z - b.z;
    const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
    if (Math.abs(lx) <= b.w / 2 && Math.abs(lz) <= b.d / 2) tinggi = Math.max(tinggi, b.elev + b.h);
  }
  return Math.round(tinggi * 1000) / 1000;
}
let nomor = 0;
export const idBaru = () => `b${Date.now().toString(36)}${(nomor++).toString(36)}`;
/** Benda baru di tengah ruang k (dinding depan untuk display). */
export function bendaBaru(jenis: Jenis, k: Kotak, atur: Partial<Benda> = {}): Benda {
  const dasar = { id: idBaru(), jenis, nama: LABEL[jenis], x: k.x0 + k.p / 2, z: k.l / 2, rot: 0, ...atur };
  const jadi = (b: Benda) => terapkanUkuran(b);
  switch (jenis) {
    case 'videowall': {
      const b = jadi({ ...dasar, w: 0, h: 0, d: 0, elev: 0.8, vw: '55BDL2105X', kol: 2, bar: 2, pasang: 'dinding', konten: 'pola', ...atur } as Benda);
      return { ...b, nama: `Videowall ${spekVideowall(b).inci}" ${b.kol}×${b.bar}`, z: b.d / 2 + CELAH_PASANG[pasangDari(b)] };
    }
    case 'led': {
      const ps = atur.pasang ?? 'hollow';
      return { ...dasar, z: 0.05 + CELAH_PASANG[ps], w: 4, h: 2.25, d: 0.1, elev: ps === 'standfloor' ? 0.72 : 0.6, pitch: 2.5, cabW: 500, cabH: 500, pasang: ps, konten: 'pola', ...atur };
    }
    case 'layar': { const b = jadi({ ...dasar, z: 0.05, w: 0, h: 0, d: 0.03, elev: 0.9, diag: 120, rasio: '16:9', konten: 'pola', ...atur } as Benda); return { ...b, nama: `Layar ${b.diag}" ${b.rasio}` }; }
    case 'ifp': {
      const stand = (atur.pasang ?? 'dinding') === 'standfloor';
      const b = jadi({ ...dasar, z: stand ? 0.5 : 0.07, w: 0, h: 0, d: 0, elev: stand ? 0.72 : 0.85, diag: 75, pasang: stand ? 'standfloor' : 'dinding', konten: 'pola', ...atur } as Benda);
      return { ...b, nama: `Interactive ${b.diag}"${stand ? ' standfloor' : ''}` };
    }
    case 'tv': {
      const stand = atur.pasang === 'standfloor';
      return jadi({ ...dasar, z: stand ? 0.5 : 0.03 + CELAH_PASANG[atur.pasang ?? 'dinding'], w: 0, h: 0, d: 0.06, elev: stand ? 0.75 : 1.0, diag: 65, pasang: 'dinding', konten: 'pola', ...atur } as Benda);
    }
    case 'meja': {
      const bentuk = atur.bentukMeja ?? 'rapat';
      if (bentuk === 'bulat') return { ...dasar, nama: 'Meja bundar', z: k.l * 0.55, w: 1.2, h: 0.75, d: 1.2, elev: 0, bentukMeja: 'bulat', finish: 'walnut', ...atur };
      if (bentuk === 'kelas') return { ...dasar, nama: 'Meja kelas', z: k.l * 0.5, w: 1.2, h: 0.75, d: 0.5, elev: 0, bentukMeja: 'kelas', finish: 'oak', ...atur };
      if (bentuk === 'dosen') return { ...dasar, nama: 'Meja dosen', x: k.x0 + Math.min(1.8, k.p * 0.25), z: 1.5, w: 1.6, h: 0.75, d: 0.75, elev: 0, bentukMeja: 'dosen', finish: 'oak', ...atur };
      if (bentuk === 'podium') return { ...dasar, nama: 'Podium', x: k.x0 + Math.min(3, k.p * 0.35), z: 1.3, w: 0.6, h: 1.15, d: 0.5, elev: 0, bentukMeja: 'podium', finish: 'walnut', ...atur };
      if (bentuk === 'kredensa') return { ...dasar, nama: 'Kredensa', z: 0.25, w: Math.min(2.4, k.p * 0.5), h: 0.75, d: 0.45, elev: 0, bentukMeja: 'kredensa', finish: 'walnut', ...atur };
      if (bentuk === 'operator') return { ...dasar, nama: 'Meja operator', z: Math.min(k.l - 1, k.l * 0.55), w: 1.8, h: 0.75, d: 0.8, elev: 0, bentukMeja: 'operator', monitorMeja: 4, finish: 'walnut', ...atur };
      return { ...dasar, nama: 'Meja rapat', z: k.l * 0.55, w: 1.2, h: 0.75, d: 3.6, elev: 0, bentukMeja: 'rapat', finish: 'walnut', ...atur };
    }
    case 'kursi': return (atur.tipeKursi ?? 'kantor') === 'kelas'
      ? { ...dasar, nama: 'Kursi kelas', z: k.l * 0.8, w: 0.47, h: 0.82, d: 0.5, elev: 0, rot: 180, tipeKursi: 'kelas', ...atur }
      : { ...dasar, nama: 'Kursi', z: k.l * 0.8, w: 0.58, h: 1.02, d: 0.58, elev: 0, rot: 180, tipeKursi: 'kantor', ...atur };
    case 'speaker': {
      const tipe = atur.tipeSpeaker ?? 'kotak';
      if (tipe === 'dinding6') return { ...dasar, nama: 'Speaker dinding 6"', x: k.x0 + 0.4, z: 0.15, w: 0.2, h: 0.3, d: 0.24, elev: 2.0, tipeSpeaker: 'dinding6', ...atur };
      if (tipe === 'kolom') return { ...dasar, nama: 'Speaker portable aktif', x: k.x0 + 0.6, z: 0.6, w: 0.38, h: 2.0, d: 0.45, elev: 0, tipeSpeaker: 'kolom', ...atur };
      if (tipe === 'linearray') {
        const n = Math.max(1, Math.min(24, Math.round(atur.modul ?? 2)));
        return { ...dasar, nama: `Line array ${n} modul`, x: k.x0 + 0.8, z: 0.6, w: 0.7, h: 0.3 * n, d: 0.45, elev: 0, tipeSpeaker: 'linearray', modul: n, sudutModul: 0, tiltLA: 0, ...atur };
      }
      return { ...dasar, nama: 'Speaker dinding kotak', x: k.x0 + 0.4, z: 0.17, w: 0.21, h: 0.32, d: 0.2, elev: 2.0, tipeSpeaker: 'kotak', ...atur };
    }
    case 'speaker-plafon': return { ...dasar, w: 0.24, h: 0.06, d: 0.24, elev: k.t - 0.06, ...atur };
    case 'lampu': {
      const tipe = atur.tipeLampu ?? 'downlight', sp = SPEK_LAMPU[tipe];
      const gantung = sp.gantung > 0 ? atur.gantungLampu ?? sp.gantung : 0;
      return { ...dasar, nama: sp.label, w: sp.w, h: sp.h, d: sp.d, elev: Math.max(0.5, k.t - sp.h - gantung), tipeLampu: tipe, lumen: sp.lumen, sudutLampu: sp.sudut,
        dimmer: 100, kelvin: tipe === 'gantung' ? 3000 : 4000, ...(sp.gantung > 0 ? { gantungLampu: gantung } : {}), ...atur };
    }
    case 'mic': return (atur.mic ?? 'gooseneck') === 'boundary'
      ? { ...dasar, z: k.l * 0.55, w: 0.18, h: 0.032, d: 0.18, elev: 0.75, mic: 'boundary', nama: 'Mic boundary', ...atur }
      : { ...dasar, z: k.l * 0.55, w: 0.12, h: 0.42, d: 0.12, elev: 0.75, mic: 'gooseneck', nama: 'Mic gooseneck', ...atur };
    case 'touchpanel': return { ...dasar, z: k.l * 0.4, w: 0.26, h: 0.16, d: 0.17, elev: 0.75, rot: 180, ...atur };
    case 'kamera': {
      const tipe = atur.tipeKamera ?? 'ptz';
      if (tipe === 'xbar') return { ...dasar, nama: 'Camera soundbar', z: 0.12, w: 0.9, h: 0.1, d: 0.09, elev: 0.62, tipeKamera: 'xbar', ...atur };
      if (tipe === 'ptz-ai') return { ...dasar, nama: 'Kamera PTZ AI', z: 0.12, w: 0.28, h: 0.15, d: 0.09, elev: 0.4, tipeKamera: 'ptz-ai', ...atur };
      return { ...dasar, nama: 'Kamera PTZ', z: 0.15, w: 0.17, h: 0.19, d: 0.17, elev: 0.4, tipeKamera: 'ptz', ...atur };
    }
    case 'perangkat': {
      const t = atur.tipePerangkat ?? 'laptop', sp = SPEK_PERANGKAT[t];
      const nama = t === 'laptop' && atur.pakaiDongle ? 'Laptop + dongle WyreStorm' : sp.label;
      //  Di atas meja rapat bawaan (tinggi 0,75 m), menghadap ke depan ruang (layar laptop/monitor ke penonton di belakangnya).
      return { ...dasar, nama, z: k.l * 0.55, w: sp.w, h: sp.h, d: sp.d, elev: 0.75, rot: 180, tipePerangkat: t, ...atur };
    }
    case 'lift': return { ...dasar, nama: 'Paperless display lift', z: k.l * 0.55, w: 0.55, h: 0.3, d: 0.22, elev: 0.75, naik: true, ...atur };
    case 'proyektor': return (atur.pasangProyektor ?? 'plafon') === 'meja'
      ? { ...dasar, nama: 'Proyektor portabel', z: k.l * 0.6, w: 0.3, h: 0.09, d: 0.23, elev: 0.75, rot: 180, pasangProyektor: 'meja', throwRatio: 1.5, trMin: 1.48, trMax: 1.78, ...atur }
      : { ...dasar, nama: 'Proyektor plafon', z: Math.min(4, k.l * 0.65), w: 0.44, h: 0.14, d: 0.36, elev: Math.max(0.5, k.t - 0.5), rot: 180, pasangProyektor: 'plafon', throwRatio: 1.6, trMin: 1.39, trMax: 2.09, ...atur };
    case 'rak': { const b = jadi({ ...dasar, x: k.x0 + k.p - 0.45, z: 0.45, w: 0.6, h: 0, d: 0.8, elev: 0, rakU: 20, tipeRak: 'kaca', ...atur } as Benda); return { ...b, nama: `Rack ${b.rakU}U` }; }
    case 'model': return { ...dasar, w: 1, h: 1, d: 1, elev: 0, ...atur };
    case 'objek': {
      const bentuk = atur.bentukObjek ?? 'kotak';
      const [w, h, d] = UKURAN_OBJEK[bentuk];
      return { ...dasar, nama: atur.nama ?? LABEL_BENTUK_OBJEK[bentuk], w, h, d, elev: 0, bentukObjek: bentuk, ...atur };
    }
    case 'tribun': {
      const b = terapkanUkuran({ ...dasar, w: 0, h: 0, d: 0, elev: 0, rot: 180, baris: 8, kursiBaris: 12, tinggiAnak: 0.35, ...atur } as Benda);
      return { ...b, nama: `Tribun ${b.baris} baris × ${b.kursiBaris}`, z: Math.max(b.d / 2, k.l - b.d / 2 - 0.3), ...(atur.z !== undefined ? { z: atur.z } : {}) };
    }
    case 'panggung': {
      const w = Math.min(10, Math.max(2, k.p * 0.7)), d = Math.min(4, Math.max(1.5, k.l * 0.25));
      return { ...dasar, nama: 'Panggung', z: d / 2 + 0.1, w, h: 0.6, d, elev: 0, ...atur };
    }
    case 'bidang': {
      const bentuk = atur.bentukBidang ?? 'lengkung';
      if (bentuk === 'datar') {
        const b = terapkanUkuran({ ...dasar, nama: 'Layar mapping datar', w: 5, h: 2.8, d: 0.06, elev: 0.3, bentukBidang: 'datar', ...atur } as Benda);
        return { ...b, z: atur.z ?? b.d / 2 + 0.2 };
      }
      const lengkung = bentuk === 'lengkung';
      const b = terapkanUkuran({ ...dasar, nama: lengkung ? 'Layar mapping cekung' : 'Layar mapping cembung', w: 0, h: lengkung ? 2.5 : 3, d: 0, elev: lengkung ? 0.3 : 0,
        bentukBidang: lengkung ? 'lengkung' : 'cembung', jariBidang: lengkung ? 4 : 0.8, busur: lengkung ? 90 : 360, ...atur } as Benda);
      if ((b.busur ?? 90) >= 360) return { ...b, nama: atur.nama ?? 'Pilar mapping 360°', z: atur.z ?? k.l / 2 };
      return { ...b, z: atur.z ?? b.d / 2 + 0.2 };
    }
  }
}
export function contohAwal(r: Ruang): Benda[] {
  const k = daftarRuang(r)[0];
  const vw = bendaBaru('videowall', k);
  const meja = bendaBaru('meja', k);
  const kam = { ...bendaBaru('kamera', k), elev: vw.elev - 0.3 };
  const kursi: Benda[] = [];
  for (let i = 0; i < 3; i++) {
    for (const sisi of [-1, 1]) {
      kursi.push({ ...bendaBaru('kursi', k), x: k.p / 2 + sisi * 1.05, z: meja.z - 1.1 + i * 1.1, rot: sisi < 0 ? 90 : -90 });
    }
  }
  return [vw, meja, kam, ...kursi,
    { ...bendaBaru('mic', k), x: k.p / 2 - 0.3, z: meja.z - 0.6, rot: 270 }, { ...bendaBaru('mic', k), x: k.p / 2 + 0.3, z: meja.z + 0.6, rot: 90 },
    { ...bendaBaru('touchpanel', k), z: meja.z + meja.d / 2 - 0.2 },
    { ...bendaBaru('speaker-plafon', k), z: k.l / 3 }, { ...bendaBaru('speaker-plafon', k), z: (k.l * 2) / 3 },
    bendaBaru('rak', k)];
}
/**
 * Set ruang kelas: deret meja siswa (2 orang/meja) menghadap dinding depan
 * (tempat display), kursi di belakang tiap meja, dan meja pengajar di depan
 * kiri. Jumlah kolom/baris menyesuaikan ukuran ruang (maks 4 x 6 meja).
 */
/** Pilihan Set ruang kelas; yang kosong dihitung otomatis dari ukuran ruang. */
export interface OpsiKelas { kolom?: number; baris?: number; jarakBaris?: number; celah?: number; kursiPerMeja?: number; pengajar?: boolean }
/** Hitungan Set ruang kelas yang dipakai: isian sendiri, atau otomatis dari ukuran ruang. */
export function ukuranSetKelas(k: Kotak, o: OpsiKelas = {}) {
  const perMeja = Math.max(1, Math.min(3, Math.round(o.kursiPerMeja ?? 2)));
  const lebar = perMeja === 1 ? 0.7 : perMeja === 2 ? 1.2 : 1.7;
  const celah = Math.max(0.2, Math.min(3, o.celah ?? 0.4)), jarakBaris = Math.max(0.8, Math.min(4, o.jarakBaris ?? 1.15));
  const kolom = Math.max(1, Math.min(12, Math.round(o.kolom ?? Math.max(1, Math.min(4, Math.floor((k.p - 0.8 + celah) / (lebar + celah)))))));
  const zMulai = Math.min(2.4, Math.max(1.6, k.l * 0.3));
  const baris = Math.max(1, Math.min(20, Math.round(o.baris ?? Math.max(1, Math.min(6, Math.floor((k.l - zMulai - 0.7) / jarakBaris) + 1)))));
  return { perMeja, lebar, celah, jarakBaris, kolom, zMulai, baris };
}
export function setRuangKelas(k: Kotak, o: OpsiKelas = {}): Benda[] {
  const { perMeja, lebar, celah, jarakBaris, kolom, zMulai, baris } = ukuranSetKelas(k, o);
  const total = kolom * lebar + (kolom - 1) * celah;
  const hasil: Benda[] = [];
  for (let r = 0; r < baris; r++) {
    for (let c = 0; c < kolom; c++) {
      const x = k.x0 + k.p / 2 - total / 2 + lebar / 2 + c * (lebar + celah);
      const z = zMulai + r * jarakBaris;
      hasil.push({ ...bendaBaru('meja', k, { bentukMeja: 'kelas' }), x, z, w: lebar, nama: `Meja kelas ${r + 1}.${c + 1}` });
      for (let j = 0; j < perMeja; j++) {
        const sx = ((j + 0.5) / perMeja - 0.5) * lebar;
        hasil.push({ ...bendaBaru('kursi', k, { tipeKursi: 'kelas' }), x: x + sx, z: z + 0.45, rot: 180 });
      }
    }
  }
  if (o.pengajar !== false) hasil.push({
    ...bendaBaru('meja', k, { bentukMeja: 'rapat', finish: 'oak' }),
    x: k.x0 + Math.min(1.3, k.p * 0.22), z: Math.max(0.9, zMulai - 0.95), w: 1.4, d: 0.7, nama: 'Meja pengajar',
  });
  return hasil;
}
/** Titik penonton: kursi, dan kursi bayangan di sekeliling meja yang belum berkursi. */
export function titikPenonton(b: Benda[]): { x: number; z: number; id: string }[] {
  const tribun = b.filter(x => x.jenis === 'tribun').flatMap(t => kursiTribun(t).map((p, i) => ({ x: p.x, z: p.z, id: `${t.id}#${i}` })));
  const kursi = b.filter(x => x.jenis === 'kursi');
  if (kursi.length || tribun.length) return [...kursi.map(k => ({ x: k.x, z: k.z, id: k.id })), ...tribun];
  const hasil: { x: number; z: number; id: string }[] = [];
  for (const x of b.filter(m => m.jenis === 'meja' && !['kredensa', 'podium', 'dosen'].includes(m.bentukMeja ?? 'rapat'))) {
    const r = (x.rot * Math.PI) / 180;
    const lokal = [[-x.w / 2 - 0.4, -x.d / 2 + 0.3], [x.w / 2 + 0.4, -x.d / 2 + 0.3], [-x.w / 2 - 0.4, x.d / 2 - 0.3], [x.w / 2 + 0.4, x.d / 2 - 0.3], [0, x.d / 2 + 0.4]];
    for (const [lx, lz] of lokal) hasil.push({ x: x.x + lx * Math.cos(r) + lz * Math.sin(r), z: x.z - lx * Math.sin(r) + lz * Math.cos(r), id: x.id });
  }
  return hasil;
}
/** Tanda tangan bentuk: berubah = model perlu dibangun ulang (posisi, rotasi, ketinggian tidak termasuk). */
export const tandaBentuk = (b: Benda) =>
  [b.jenis, b.w, b.h, b.d, b.pitch, b.cabW, b.cabH, b.vw, b.kol, b.bar, b.pasang, b.rakU, b.mic, b.konten, b.modelKunci,
    b.bentukMeja, b.finish, b.tipeKursi, b.tipeKamera, b.naik, b.pasangProyektor, b.tilt, b.warna, b.panel ? JSON.stringify(b.panel) : '', b.diag, b.tipeSpeaker, b.modul, b.sudutModul, b.tiltLA, b.gantung,
    b.baris, b.kursiBaris, b.tinggiAnak, b.bentukBidang, b.jariBidang, b.busur, b.monitorMeja, b.tipeRak, b.tipeLampu, b.sudutLampu, b.kelvin, b.lumen,
    b.isiRak ? JSON.stringify(b.isiRak) : '', b.putarModel, b.bentukObjek, b.kontur ? JSON.stringify(b.kontur) : '', b.tipePerangkat, b.pakaiDongle].join('|');
