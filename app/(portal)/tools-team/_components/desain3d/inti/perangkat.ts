import { type Benda, DISPLAY, type Jenis, type Titik, type TipePerangkat } from './tipe';

export const SPEK_PERANGKAT: Record<TipePerangkat, { label: string; ket: string; w: number; h: number; d: number }> = {
  pc: { label: 'PC desktop', ket: 'Monitor 24" + CPU tower + keyboard & mouse (berkabel ke rack)', w: 0.78, h: 0.46, d: 0.5 },
  laptop: { label: 'Laptop', ket: 'Laptop 14" terbuka', w: 0.313, h: 0.215, d: 0.222 },
  dongle: { label: 'Dongle WyreStorm', ket: 'Dongle USB-C share layar nirkabel (tanpa kabel)', w: 0.075, h: 0.018, d: 0.17 },
  hp: { label: 'HP / smartphone', ket: 'Share layar nirkabel lewat aplikasi', w: 0.076, h: 0.009, d: 0.16 },
  tablet: { label: 'Tablet', ket: 'Share layar nirkabel lewat aplikasi', w: 0.25, h: 0.008, d: 0.175 },
};

export const tipePerangkatDari = (b: Pick<Benda, 'tipePerangkat'>): TipePerangkat => b.tipePerangkat ?? 'laptop';

export function nirkabel(b: Pick<Benda, 'jenis' | 'tipePerangkat' | 'pakaiDongle'>): boolean {
  if (b.jenis !== 'perangkat') return false;
  const t = tipePerangkatDari(b);
  return t === 'dongle' || t === 'hp' || t === 'tablet' || (t === 'laptop' && !!b.pakaiDongle);
}

export const JENIS_TUJUAN: Jenis[] = [...DISPLAY, 'bidang', 'proyektor'];
export const bisaJadiTujuan = (b: Benda) => JENIS_TUJUAN.includes(b.jenis);

export function tujuanShare(b: Benda, semua: Benda[]): Benda | null {
  if (!nirkabel(b)) return null;
  const calon = semua.filter(bisaJadiTujuan);
  const dipilih = b.layarTujuan ? calon.find(x => x.id === b.layarTujuan) : undefined;
  if (dipilih) return dipilih;
  let terbaik: Benda | null = null, jarak = Infinity;
  for (const c of calon) {
    const j = Math.hypot(c.x - b.x, c.z - b.z);
    if (j < jarak) { jarak = j; terbaik = c; }
  }
  return terbaik;
}

export function titikTujuan(t: Benda): Titik {
  const r = (t.rot * Math.PI) / 180;
  const maju = t.jenis === 'proyektor' ? 0 : t.d / 2;
  return [t.x + Math.sin(r) * maju, t.elev + t.h / 2, t.z + Math.cos(r) * maju];
}

export function busurShare(dari: Titik, ke: Titik, n = 24): Titik[] {
  const jarak = Math.hypot(ke[0] - dari[0], ke[1] - dari[1], ke[2] - dari[2]);
  const tengah: Titik = [(dari[0] + ke[0]) / 2, Math.max(dari[1], ke[1]) + 0.3 + jarak * 0.2, (dari[2] + ke[2]) / 2];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, a = (1 - t) ** 2, b2 = 2 * (1 - t) * t, c = t * t;
    return [a * dari[0] + b2 * tengah[0] + c * ke[0], a * dari[1] + b2 * tengah[1] + c * ke[1], a * dari[2] + b2 * tengah[2] + c * ke[2]] as Titik;
  });
}

export function jalurShare(semua: Benda[]): { dari: Benda; ke: Benda; titik: Titik[] }[] {
  const hasil: { dari: Benda; ke: Benda; titik: Titik[] }[] = [];
  for (const b of semua) {
    const t = tujuanShare(b, semua);
    if (t) hasil.push({ dari: b, ke: t, titik: busurShare([b.x, b.elev + b.h + 0.02, b.z], titikTujuan(t)) });
  }
  return hasil;
}
