/**
 * Tata letak Desain 3D: tapak benda (ikut rotasi), ratakan & sebar benda terpilih, magnet ke tepi benda lain,
 * larik (ulangi dalam baris x kolom), geser tepat (mm), dan kelompok benda untuk sembunyikan / isolasi.
 * Benda `terkunci` tidak ikut dipindah. Murni (diuji di uji/desain3d-tata.ts).
 */
import { idBaru } from './katalog';
import type { Benda, Jenis } from './tipe';

export interface Tapak { x0: number; x1: number; z0: number; z1: number }

/** Kotak tapak di lantai (m), memperhitungkan putaran benda. */
export function tapak(b: Pick<Benda, 'x' | 'z' | 'w' | 'd' | 'rot'>): Tapak {
  const r = (b.rot * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const hx = (c * b.w + s * b.d) / 2, hz = (s * b.w + c * b.d) / 2;
  return { x0: b.x - hx, x1: b.x + hx, z0: b.z - hz, z1: b.z + hz };
}

const mm = (v: number) => Math.round(v * 1000) / 1000;
const bisaPindah = (b: Benda, ids: Set<string>) => ids.has(b.id) && !b.terkunci;

export type CaraRata = 'awal' | 'tengah' | 'akhir';

/** Ratakan benda terpilih ke tepi kiri / tengah / kanan (sumbu x) atau depan / tengah / belakang (sumbu z) kelompoknya. */
export function ratakan(benda: Benda[], idDipilih: string[], sumbu: 'x' | 'z', cara: CaraRata): Benda[] {
  const ids = new Set(idDipilih);
  const pilih = benda.filter(b => ids.has(b.id));
  if (pilih.length < 2) return benda;
  const t = pilih.map(tapak);
  const [k0, k1] = sumbu === 'x' ? ['x0', 'x1'] as const : ['z0', 'z1'] as const;
  const awal = Math.min(...t.map(x => x[k0])), akhir = Math.max(...t.map(x => x[k1])), tengah = (awal + akhir) / 2;
  return benda.map(b => {
    if (!bisaPindah(b, ids)) return b;
    const tp = tapak(b), pusat = sumbu === 'x' ? b.x : b.z;
    const geser = cara === 'awal' ? awal - tp[k0] : cara === 'akhir' ? akhir - tp[k1] : tengah - (tp[k0] + tp[k1]) / 2;
    return sumbu === 'x' ? { ...b, x: mm(pusat + geser) } : { ...b, z: mm(pusat + geser) };
  });
}

/** Sebar merata: benda pertama & terakhir (urut posisi) tetap, celah antar tapak dibuat sama. Minimal 3 benda. */
export function sebar(benda: Benda[], idDipilih: string[], sumbu: 'x' | 'z'): Benda[] {
  const ids = new Set(idDipilih);
  const pilih = benda.filter(b => ids.has(b.id)).sort((a, c) => (sumbu === 'x' ? a.x - c.x : a.z - c.z));
  if (pilih.length < 3) return benda;
  const [k0, k1] = sumbu === 'x' ? ['x0', 'x1'] as const : ['z0', 'z1'] as const;
  const t = pilih.map(tapak);
  const total = t.reduce((s, x) => s + (x[k1] - x[k0]), 0);
  const celah = (t[t.length - 1][k1] - t[0][k0] - total) / (pilih.length - 1);
  const posisi = new Map<string, number>();
  let tepi = t[0][k0];
  pilih.forEach((b, i) => {
    const lebar = t[i][k1] - t[i][k0];
    const pusatLama = sumbu === 'x' ? b.x : b.z;
    posisi.set(b.id, mm(pusatLama + (tepi - t[i][k0])));
    tepi += lebar + celah;
  });
  return benda.map(b => (!bisaPindah(b, ids) || !posisi.has(b.id) ? b : sumbu === 'x' ? { ...b, x: posisi.get(b.id)! } : { ...b, z: posisi.get(b.id)! }));
}

/**
 * Magnet: posisi (x, z) benda yang sedang digeser ditarik ke tepi / tengah benda lain bila jaraknya < `toleransi`.
 * Menempel (tepi ke tepi) hanya ke benda yang bersebelahan di sumbu lain; sejajar (tepi sama / tengah) ke benda mana pun.
 */
export function magnet(b: Benda, lain: Benda[], toleransi = 0.05): { x: number; z: number; tarikX: boolean; tarikZ: boolean } {
  const t = tapak(b);
  let dx = Infinity, dz = Infinity;
  const coba = (d: number, sumbu: 'x' | 'z') => {
    if (Math.abs(d) >= toleransi) return;
    if (sumbu === 'x' && Math.abs(d) < Math.abs(dx)) dx = d;
    if (sumbu === 'z' && Math.abs(d) < Math.abs(dz)) dz = d;
  };
  for (const o of lain) {
    if (o.id === b.id) continue;
    const u = tapak(o);
    const dekatZ = t.z0 < u.z1 + toleransi && t.z1 > u.z0 - toleransi;
    const dekatX = t.x0 < u.x1 + toleransi && t.x1 > u.x0 - toleransi;
    if (dekatZ) { coba(u.x1 - t.x0, 'x'); coba(u.x0 - t.x1, 'x'); }
    if (dekatX) { coba(u.z1 - t.z0, 'z'); coba(u.z0 - t.z1, 'z'); }
    coba(u.x0 - t.x0, 'x'); coba(u.x1 - t.x1, 'x'); coba(o.x - b.x, 'x');
    coba(u.z0 - t.z0, 'z'); coba(u.z1 - t.z1, 'z'); coba(o.z - b.z, 'z');
  }
  return { x: mm(b.x + (Number.isFinite(dx) ? dx : 0)), z: mm(b.z + (Number.isFinite(dz) ? dz : 0)), tarikX: Number.isFinite(dx), tarikZ: Number.isFinite(dz) };
}

export const MAKS_LARIK = 200;

/** Larik: salinan benda dalam `kolom` (sumbu x) × `baris` (sumbu z) berjarak jx / jz (m). Asli di sel pertama; yang keluar batas dibuang. */
export function larik(b: Benda, kolom: number, baris: number, jx: number, jz: number, batas: { x: number; z: number }): Benda[] {
  const k = Math.max(1, Math.min(50, Math.round(kolom))), r = Math.max(1, Math.min(50, Math.round(baris)));
  const hasil: Benda[] = [];
  for (let j = 0; j < r; j++) for (let i = 0; i < k; i++) {
    if (!i && !j) continue;
    const x = mm(b.x + i * jx), z = mm(b.z + j * jz);
    if (x < 0 || z < 0 || x > batas.x || z > batas.z) continue;
    hasil.push({ ...b, id: idBaru(), x, z, terkunci: undefined });
    if (hasil.length >= MAKS_LARIK) return hasil;
  }
  return hasil;
}

/** Geser tepat `meter` sepanjang sumbu dunia x / z (benda terkunci tidak bergerak), dijepit di dalam ruangan. */
export function geserTepat(benda: Benda[], idDipilih: string[], sumbu: 'x' | 'z', meter: number, batas: { x: number; z: number }): Benda[] {
  const ids = new Set(idDipilih);
  return benda.map(b => {
    if (!bisaPindah(b, ids)) return b;
    return sumbu === 'x' ? { ...b, x: mm(Math.min(batas.x, Math.max(0, b.x + meter))) } : { ...b, z: mm(Math.min(batas.z, Math.max(0, b.z + meter))) };
  });
}

// ── Kelompok & benda: sembunyikan / isolasi ─────────────────────────────────

export type Golongan = 'display' | 'proyeksi' | 'audio' | 'konferensi' | 'furnitur' | 'lampu' | 'rak' | 'objek';
export const LABEL_GOLONGAN: Record<Golongan, string> = {
  display: 'Display & LED', proyeksi: 'Proyektor & bidang', audio: 'Audio', konferensi: 'Kamera, panel & perangkat',
  furnitur: 'Furnitur & venue', lampu: 'Lampu', rak: 'Rack', objek: 'Objek, model & teks',
};
const GOLONGAN_JENIS: Record<Jenis, Golongan> = {
  videowall: 'display', led: 'display', layar: 'display', ifp: 'display', tv: 'display',
  proyektor: 'proyeksi', bidang: 'proyeksi',
  speaker: 'audio', 'speaker-plafon': 'audio', mic: 'audio',
  kamera: 'konferensi', touchpanel: 'konferensi', lift: 'konferensi', perangkat: 'konferensi',
  meja: 'furnitur', kursi: 'furnitur', tribun: 'furnitur', panggung: 'furnitur',
  lampu: 'lampu', rak: 'rak', model: 'objek', objek: 'objek', teks: 'objek',
};
export const golonganDari = (j: Jenis): Golongan => GOLONGAN_JENIS[j];
/** Kunci sembunyi satu benda di daftar sembunyi (daftar yang sama berisi nama kelompok). */
export const kunciSembunyi = (id: string) => `#${id}`;
/** Benda tampil bila kelompoknya maupun benda itu sendiri tidak disembunyikan. */
export const tampilDi = (b: Pick<Benda, 'jenis' | 'id'>, sembunyi: readonly string[]) =>
  !sembunyi.includes(GOLONGAN_JENIS[b.jenis]) && !sembunyi.includes(kunciSembunyi(b.id));
/** Jumlah benda yang disembunyikan satu per satu (bukan lewat kelompok). */
export const jumlahSembunyiSendiri = (sembunyi: readonly string[]) => sembunyi.filter(k => k.startsWith('#')).length;
