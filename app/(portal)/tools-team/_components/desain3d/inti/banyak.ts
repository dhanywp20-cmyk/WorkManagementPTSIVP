/**
 * desain3d/inti/banyak.ts - Pilih banyak benda sekaligus (Shift / Ctrl + klik, atau mode pilih banyak):
 * geser & putar bersama mengikuti benda utama (gizmo), skala ukuran, samakan ukuran, rata tepi,
 * duplikat. Murni - diuji di uji/desain3d-banyak.ts.
 */
import { idBaru } from './katalog';
import { terapkanUkuran } from './produk';
import type { Benda } from './tipe';

const bulat = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** Klik dengan Shift / Ctrl: tambah / lepas dari pilihan. `pilih` = benda utama (panel & gizmo). */
export function togglePilih(pilih: string | null, lain: string[], id: string): { pilih: string | null; lain: string[] } {
  if (!pilih) return { pilih: id, lain: [] };
  if (id === pilih) return { pilih: lain[0] ?? null, lain: lain.slice(1) };
  return lain.includes(id) ? { pilih, lain: lain.filter(x => x !== id) } : { pilih, lain: [...lain, id] };
}

/** Putar titik (x, z) mengelilingi (cx, cz) sebesar `derajat` - arah sama dengan rotation.y three.js. */
export function putarDi(x: number, z: number, cx: number, cz: number, derajat: number): [number, number] {
  const r = (derajat * Math.PI) / 180, dx = x - cx, dz = z - cz;
  return [cx + dx * Math.cos(r) + dz * Math.sin(r), cz - dx * Math.sin(r) + dz * Math.cos(r)];
}

/**
 * Benda utama digeser / diputar dari `lama` ke `baru` (gizmo): benda lain di `ids` ikut - tergeser
 * sejauh yang sama, dan berputar mengelilingi benda utama sebesar perubahan rotasinya.
 */
export function ikutUtama(benda: Benda[], ids: string[], lama: Benda, baru: Pick<Benda, 'x' | 'z' | 'elev' | 'rot'>): Benda[] {
  const dRot = baru.rot - lama.rot, dx = baru.x - lama.x, dz = baru.z - lama.z, dE = baru.elev - lama.elev;
  if (!dRot && !dx && !dz && !dE) return benda;
  const set = new Set(ids);
  return benda.map(b => {
    if (!set.has(b.id) || b.id === lama.id) return b;
    const [x, z] = dRot ? putarDi(b.x, b.z, lama.x, lama.z, dRot) : [b.x, b.z];
    return { ...b, x: bulat(x + dx, 2), z: bulat(z + dz, 2), elev: bulat(Math.max(0, b.elev + dE), 2), rot: (((b.rot + dRot) % 360) + 360) % 360 };
  });
}

/** Skala ukuran semua benda terpilih (display ber-diagonal: diagonalnya ikut). */
export function skalaBanyak(benda: Benda[], ids: string[], faktor: number): Benda[] {
  const f = Math.min(10, Math.max(0.1, faktor)), set = new Set(ids);
  return benda.map(b => {
    if (!set.has(b.id)) return b;
    const x: Benda = { ...b, w: bulat(b.w * f), h: bulat(b.h * f), d: bulat(b.d * f), ...(b.diag ? { diag: Math.round(b.diag * f) } : {}) };
    return terapkanUkuran(x);
  });
}

/** Isi ukuran yang sama (m) untuk semua benda terpilih - kolom yang tidak diisi dibiarkan. */
export function ukuranBanyak(benda: Benda[], ids: string[], u: Partial<Pick<Benda, 'w' | 'h' | 'd' | 'elev'>>): Benda[] {
  const set = new Set(ids);
  return benda.map(b => (set.has(b.id) ? terapkanUkuran({ ...b, ...u }) : b));
}

/** Setengah lebar tapak (x) & dalam (z) setelah diputar. */
function tapak(b: Benda): [number, number] {
  const r = (b.rot * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  return [(c * b.w + s * b.d) / 2, (s * b.w + c * b.d) / 2];
}

export type Rata = 'kiri' | 'tengah-x' | 'kanan' | 'depan' | 'tengah-z' | 'belakang';

/** Ratakan tepi (atau tengah) semua benda terpilih ke tepi terluar kelompok. */
export function rataBanyak(benda: Benda[], ids: string[], rata: Rata): Benda[] {
  const set = new Set(ids), pilih = benda.filter(b => set.has(b.id));
  if (pilih.length < 2) return benda;
  const sumbuX = rata === 'kiri' || rata === 'kanan' || rata === 'tengah-x';
  const tepi = pilih.map(b => { const [ex, ez] = tapak(b); return sumbuX ? [b.x - ex, b.x + ex] : [b.z - ez, b.z + ez]; });
  const min = Math.min(...tepi.map(t => t[0])), maks = Math.max(...tepi.map(t => t[1])), tengah = (min + maks) / 2;
  return benda.map(b => {
    if (!set.has(b.id)) return b;
    const [ex, ez] = tapak(b), e = sumbuX ? ex : ez;
    const v = rata === 'kiri' || rata === 'depan' ? min + e : rata === 'kanan' || rata === 'belakang' ? maks - e : tengah;
    return sumbuX ? { ...b, x: bulat(v, 2) } : { ...b, z: bulat(v, 2) };
  });
}

/** Duplikat semua benda terpilih (bergeser 0,6 m ke kanan); mengembalikan benda baru & id-nya. */
export function duplikatBanyak(benda: Benda[], ids: string[], batasX: number): { benda: Benda[]; baru: Benda[] } {
  const set = new Set(ids);
  const baru = benda.filter(b => set.has(b.id)).map(b => ({ ...b, id: idBaru(), x: bulat(Math.min(batasX, b.x + 0.6), 2) }));
  return { benda: [...benda, ...baru], baru };
}
