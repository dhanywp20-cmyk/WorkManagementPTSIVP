import type { Lensa } from './blending';
import { bolaBidang, ukuranBidang } from './produk';
import type { Benda, Titik } from './tipe';

export const JENIS_BIDANG_MASK = new Set<Benda['jenis']>(['layar', 'bidang']);
export type UjiArah = (dx: number, dy: number, dz: number) => boolean;
export type UjiBidang = (O: Titik) => UjiArah;

const SEL = 1e-6;
const sudutDalam = (x: number, z: number, a0: number, tb: number) => {
  if (tb >= 2 * Math.PI - SEL) return true;
  let a = Math.atan2(x, z) - a0;
  a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return a <= tb + SEL;
};

export type KenaArah = (dx: number, dy: number, dz: number) => number;

export function kenaBidang(b: Benda): (O: Titik) => KenaArah {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const bentuk = b.jenis === 'layar' ? 'datar' : b.bentukBidang ?? 'datar';
  return O => {
    const dx0 = O[0] - b.x, dz0 = O[2] - b.z;
    const ox = dx0 * c - dz0 * s, oy = O[1] - b.elev, oz = dx0 * s + dz0 * c;
    if (bentuk === 'datar') {
      const w = b.jenis === 'layar' ? b.w : ukuranBidang(b).w, muka = b.jenis === 'layar' ? b.d / 2 : 0.02;
      return (dx, dy, dz) => {
        const lz = dx * s + dz * c;
        if (Math.abs(lz) < 1e-9) return 0;
        const t = (muka - oz) / lz;
        if (t <= 0) return 0;
        const x = ox + (dx * c - dz * s) * t, y = oy + dy * t;
        if (Math.abs(x) > w / 2 + SEL || y < -SEL || y > b.h + SEL) return 0;
        return lz < 0 ? t : -t;
      };
    }
    if (bentuk === 'bola') {
      const { R, tb, a0, zP, yP, fiM } = bolaBidang(b), batasY = R * Math.sin(fiM) + SEL;
      const px = ox, py = oy - yP, pz = oz - zP, C = px * px + py * py + pz * pz - R * R;
      return (dx, dy, dz) => {
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        const A = lx * lx + dy * dy + lz * lz, B = 2 * (px * lx + py * dy + pz * lz), disk = B * B - 4 * A * C;
        if (A < 1e-12 || disk < 0) return 0;
        const akar = Math.sqrt(disk), t1 = (-B - akar) / (2 * A), t2 = (-B + akar) / (2 * A);
        if (t1 > 0 && Math.abs(py + dy * t1) <= batasY && sudutDalam(px + lx * t1, pz + lz * t1, a0, tb)) return -t1;
        if (t2 > 0 && Math.abs(py + dy * t2) <= batasY && sudutDalam(px + lx * t2, pz + lz * t2, a0, tb)) return t2;
        return 0;
      };
    }
    const { R, busur, d } = ukuranBidang(b);
    const cembung = bentuk === 'cembung', zP = cembung ? d / 2 - R : R - d / 2;
    const tb = (busur * Math.PI) / 180, a0 = cembung ? -tb / 2 : Math.PI - tb / 2;
    const px = ox, pz = oz - zP, C = px * px + pz * pz - R * R;
    return (dx, dy, dz) => {
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const A = lx * lx + lz * lz, B = 2 * (px * lx + pz * lz), disk = B * B - 4 * A * C;
      if (A < 1e-12 || disk < 0) return 0;
      const akar = Math.sqrt(disk), t1 = (-B - akar) / (2 * A), t2 = (-B + akar) / (2 * A);
      const sah = (t: number) => { const y = oy + dy * t; return t > 0 && y >= -SEL && y <= b.h + SEL && sudutDalam(px + lx * t, pz + lz * t, a0, tb); };
      if (sah(t1)) return cembung ? t1 : -t1;
      if (sah(t2)) return cembung ? -t2 : t2;
      return 0;
    };
  };
}

export function ujiKenaBidang(b: Benda): UjiBidang {
  const kena = kenaBidang(b);
  return O => { const f = kena(O); return (dx, dy, dz) => f(dx, dy, dz) !== 0; };
}

export function kunciBidangMask(benda: Benda[]): string {
  return JSON.stringify(benda.filter(b => JENIS_BIDANG_MASK.has(b.jenis))
    .map(b => [b.jenis, b.bentukBidang ?? null, b.x, b.z, b.elev, b.rot, b.w, b.h, b.d, b.jariBidang ?? null, b.busur ?? null]));
}

export function petaMaskBidang(L: Lensa, uji: UjiBidang[], lebar: number, tinggi: number): Uint8Array {
  const hasil = new Uint8Array(lebar * tinggi);
  const fungsi = uji.map(u => u(L.O));
  if (!fungsi.length) return hasil;
  const [Dx, Dy, Dz] = L.D, [Kx, Ky, Kz] = L.kanan, [Ax, Ay, Az] = L.atas;
  for (let y = 0; y < tinggi; y++) {
    const fv = (1 - (y + 0.5) / tinggi - 0.5 + L.gV) * L.h1;
    const bx = Dx + Ax * fv, by = Dy + Ay * fv, bz = Dz + Az * fv;
    for (let x = 0; x < lebar; x++) {
      const fu = ((x + 0.5) / lebar - 0.5 + L.gH) * L.w1;
      const dx = bx + Kx * fu, dy = by + Ky * fu, dz = bz + Kz * fu;
      for (const f of fungsi) if (f(dx, dy, dz)) { hasil[y * lebar + x] = 1; break; }
    }
  }
  return hasil;
}
