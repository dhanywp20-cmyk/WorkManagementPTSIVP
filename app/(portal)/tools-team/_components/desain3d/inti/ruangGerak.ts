/**
 * Cek ruang gerak desain: benda bertumpuk, keluar ruangan / menembus plafon, ayunan pintu terhalang,
 * jarak meja rapat ke dinding, dan ruang servis di depan rack. Juga jarak benda ke keempat dinding
 * (garis ukur otomatis benda terpilih). Murni (diuji di uji/desain3d-ruang-gerak.ts).
 */
import { sudutTapak, type P2 } from './denah';
import { bukaanDinding, daftarRuang, ruangDari, sambunganKe, sisiLuar } from './ruang';
import type { Benda, Kotak, Ruang, SisiDinding } from './tipe';

export type KodeRuangGerak = 'tumpang' | 'keluar' | 'plafon' | 'pintu' | 'meja' | 'rak';
export interface CatatanRuangGerak { kode: KodeRuangGerak; id: string; pesan: string }

/** Ruang bebas minimal (m): kursi ditarik + orang lewat di sisi meja; pintu rack dibuka & teknisi berdiri. */
export const JARAK_MEJA_MIN = 0.9, SERVIS_RAK_MIN = 0.8;
const TOLERANSI = 0.03;
const cm = (m: number) => `${Math.round(m * 100)} cm`;

/** Benda yang menempati ruang di lantai / dinding (bukan teks, lampu & perangkat plafon). */
const padat = (b: Benda) => b.jenis !== 'teks' && b.jenis !== 'lampu' && b.jenis !== 'speaker-plafon' && b.elev < 2;

/** Dua poligon cembung bertumpuk (uji sumbu pemisah), dengan kelonggaran `celah` (m). */
function poligonTumpang(a: P2[], b: P2[], celah = TOLERANSI): boolean {
  for (const poli of [a, b]) {
    for (let i = 0; i < poli.length; i++) {
      const p = poli[i], q = poli[(i + 1) % poli.length];
      const n: P2 = [q[1] - p[1], p[0] - q[0]], L = Math.hypot(n[0], n[1]) || 1;
      const proj = (s: P2[]) => s.map(v => (v[0] * n[0] + v[1] * n[1]) / L);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) - celah <= Math.min(...pb) || Math.max(...pb) - celah <= Math.min(...pa)) return false;
    }
  }
  return true;
}
const persegi = (x0: number, z0: number, x1: number, z1: number): P2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const tumpangTinggi = (a: Benda, b: Benda) => Math.min(a.elev + a.h, b.elev + b.h) - Math.max(a.elev, b.elev) > TOLERANSI;

/** Jarak tapak benda ke dinding kiri, kanan, depan, belakang ruangnya (m; negatif = menembus). */
export function jarakKeDinding(b: Benda, k: Kotak): Record<SisiDinding, number> {
  const s = sudutTapak(b), xs = s.map(p => p[0]), zs = s.map(p => p[1]);
  return { kiri: Math.min(...xs) - k.x0, kanan: k.x0 + k.p - Math.max(...xs), depan: Math.min(...zs), belakang: k.l - Math.max(...zs) };
}

/** Area ayun pintu dinding luar (persegi lebar × lebar ke dalam ruang). */
function areaPintu(ruang: Ruang): { nama: string; area: P2[]; tinggi: number }[] {
  const hasil: { nama: string; area: P2[]; tinggi: number }[] = [];
  daftarRuang(ruang).forEach((k, i) => {
    for (const sisi of sisiLuar(ruang, i)) for (const l of bukaanDinding(ruang, i, sisi)) {
      if (l.b.jenis !== 'pintu') continue;
      const w = l.x1 - l.x0;
      const area = sisi === 'depan' ? persegi(k.x0 + l.x0, 0, k.x0 + l.x1, w)
        : sisi === 'belakang' ? persegi(k.x0 + k.p - l.x1, k.l - w, k.x0 + k.p - l.x0, k.l)
          : sisi === 'kiri' ? persegi(k.x0, k.l - l.x1, k.x0 + w, k.l - l.x0)
            : persegi(k.x0 + k.p - w, l.x0, k.x0 + k.p, l.x1);
      hasil.push({ nama: `Pintu dinding ${sisi}${daftarRuang(ruang).length > 1 ? ` ruang ${i + 1}` : ''}`, area, tinggi: l.y1 });
    }
  });
  return hasil;
}

export function cekRuangGerak(benda: Benda[], ruang: Ruang): CatatanRuangGerak[] {
  const hasil: CatatanRuangGerak[] = [];
  const kotak = daftarRuang(ruang);
  const isi = benda.filter(padat).map(b => ({ b, s: sudutTapak(b) }));

  //  Keluar ruangan / menembus plafon (sekat terbuka = boleh menyeberang ke ruang sebelah).
  for (const b of benda) {
    if (b.jenis === 'teks') continue;
    const i = ruangDari(ruang, b.x), k = kotak[i];
    const kiriBuka = sambunganKe(ruang, i)?.sekat === 'terbuka', kananBuka = sambunganKe(ruang, i + 1)?.sekat === 'terbuka';
    const j = jarakKeDinding(b, k);
    const keluar = (['depan', 'belakang', 'kiri', 'kanan'] as const).filter(s => j[s] < -TOLERANSI && !(s === 'kiri' && kiriBuka) && !(s === 'kanan' && kananBuka));
    if (keluar.length) hasil.push({ kode: 'keluar', id: b.id, pesan: `${b.nama} menembus dinding ${keluar.join(' & ')} (${cm(-Math.min(...keluar.map(s => j[s])))})` });
    if (b.elev + b.h > k.t + TOLERANSI) hasil.push({ kode: 'plafon', id: b.id, pesan: `${b.nama} menembus plafon (${cm(b.elev + b.h - k.t)})` });
  }

  //  Benda bertumpuk (kursi di bawah meja / tribun memang wajar).
  const wajar = (a: Benda, c: Benda) => {
    const j = [a.jenis, c.jenis];
    return j.includes('kursi') && (j.includes('meja') || j.includes('tribun'));
  };
  for (let x = 0; x < isi.length; x++) for (let y = x + 1; y < isi.length; y++) {
    const a = isi[x], c = isi[y];
    if (wajar(a.b, c.b) || !tumpangTinggi(a.b, c.b) || !poligonTumpang(a.s, c.s)) continue;
    hasil.push({ kode: 'tumpang', id: c.b.id, pesan: `${c.b.nama} bertumpuk dengan ${a.b.nama}` });
  }

  //  Ayunan pintu harus bebas.
  for (const p of areaPintu(ruang)) {
    const halang = isi.filter(({ b, s }) => b.elev < p.tinggi && poligonTumpang(s, p.area));
    if (halang.length) hasil.push({ kode: 'pintu', id: halang[0].b.id, pesan: `${p.nama} terhalang ${halang.map(h => h.b.nama).slice(0, 3).join(', ')}` });
  }

  //  Meja rapat / bundar: sisa ruang ke dinding untuk kursi & lalu lalang.
  for (const b of benda) {
    if (b.jenis !== 'meja' || !['rapat', 'bulat'].includes(b.bentukMeja ?? 'rapat')) continue;
    const j = jarakKeDinding(b, kotak[ruangDari(ruang, b.x)]);
    const sempit = (Object.entries(j) as [SisiDinding, number][]).filter(([, v]) => v >= -TOLERANSI && v < JARAK_MEJA_MIN - 0.005);
    if (sempit.length) hasil.push({ kode: 'meja', id: b.id, pesan: `${b.nama}: ke dinding ${sempit.map(([s, v]) => `${s} ${cm(v)}`).join(', ')} (min ${cm(JARAK_MEJA_MIN)})` });
  }

  //  Rack: area servis di depan pintu (arah depan benda) bebas & masih di dalam ruangan.
  for (const b of benda) {
    if (b.jenis !== 'rak') continue;
    const r = (b.rot * Math.PI) / 180, maju: P2 = [Math.sin(r), Math.cos(r)];
    const area = sudutTapak({ x: b.x + maju[0] * (b.d / 2 + SERVIS_RAK_MIN / 2), z: b.z + maju[1] * (b.d / 2 + SERVIS_RAK_MIN / 2), w: b.w, d: SERVIS_RAK_MIN, rot: b.rot });
    const k = kotak[ruangDari(ruang, b.x)];
    const diLuar = area.some(([x, z]) => x < k.x0 - TOLERANSI || x > k.x0 + k.p + TOLERANSI || z < -TOLERANSI || z > k.l + TOLERANSI);
    //  Kursi bisa digeser - bukan penghalang tetap.
    const halang = isi.filter(o => o.b.id !== b.id && o.b.jenis !== 'kursi' && o.b.elev < 1.8 && poligonTumpang(o.s, area));
    if (diLuar || halang.length) hasil.push({ kode: 'rak', id: b.id, pesan: `Depan ${b.nama} kurang ${cm(SERVIS_RAK_MIN)} untuk servis${halang.length ? ` (terhalang ${halang[0].b.nama})` : ' (dinding)'}` });
  }
  return hasil;
}
